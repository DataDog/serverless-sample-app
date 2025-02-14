use aws_lambda_events::sns::SnsMessage;
use aws_lambda_events::sqs::SqsEvent;
use event_publisher_core::{
    adapters::EventBridgeEventPublisher,
    core::PublicEventPublisher,
    ports::{
        translate_created_event, translate_deleted_event, translate_updated_event, ApplicationError,
    },
};
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use observability::{observability, TracedMessage};
use std::env;
use tracing::{info, instrument};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::util::SubscriberInitExt;

enum TopicArn {
    ProductCreated,
    ProductUpdated,
    ProductDeleted,
}

#[instrument(name = "handle-public-event-publish", skip(event_publisher, event))]
async fn function_handler<TEventPublisher: PublicEventPublisher>(
    event_publisher: &TEventPublisher,
    event: LambdaEvent<SqsEvent>,
) -> Result<(), Error> {
    for sqs_message in &event.payload.records {
        let sns_message: SnsMessage =
            serde_json::from_str(&sqs_message.body.clone().unwrap()).unwrap();

        let topic_arn = get_topic_arn(&sns_message)?;

        let traced_message: TracedMessage = sqs_message.into();

        match topic_arn {
            TopicArn::ProductCreated => {
                let evt = serde_json::from_str(&traced_message.message).unwrap();

                translate_created_event(event_publisher, evt).await
            }
            TopicArn::ProductUpdated => {
                let evt = serde_json::from_str(&traced_message.message).unwrap();

                translate_updated_event(event_publisher, evt).await
            }
            TopicArn::ProductDeleted => {
                let evt = serde_json::from_str(&traced_message.message).unwrap();

                translate_deleted_event(event_publisher, evt).await
            }
        }?;
    }

    Ok(())
}
#[tokio::main]
async fn main() -> Result<(), Error> {
    observability().init();

    let event_bus_name = env::var("EVENT_BUS_NAME").expect("EVENT_BUS_NAME is not set");
    let env = env::var("DD_ENV").expect("DD_ENV is not set");
    let config = aws_config::load_from_env().await;
    let event_bridge_client = aws_sdk_eventbridge::Client::new(&config);
    let event_publisher = EventBridgeEventPublisher::new(event_bridge_client, event_bus_name, env);

    run(service_fn(|event| {
        function_handler(&event_publisher, event)
    }))
    .await
}

fn get_topic_arn(message: &SnsMessage) -> Result<TopicArn, ApplicationError> {
    let product_created_topic_arn =
        env::var("PRODUCT_CREATED_TOPIC_ARN").expect("PRODUCT_CREATED_TOPIC_ARN is not set");
    let product_updated_topic_arn =
        env::var("PRODUCT_UPDATED_TOPIC_ARN").expect("PRODUCT_UPDATED_TOPIC_ARN is not set");
    let product_deleted_topic_arn =
        env::var("PRODUCT_DELETED_TOPIC_ARN").expect("PRODUCT_DELETED_TOPIC_ARN is not set");

    info!("Topic ARN of message is {}", &message.topic_arn);
    tracing::Span::current().set_attribute("message.topic.arn", message.topic_arn.clone());

    if message.topic_arn == product_created_topic_arn {
        Ok(TopicArn::ProductCreated)
    } else if message.topic_arn == product_updated_topic_arn {
        Ok(TopicArn::ProductUpdated)
    } else if message.topic_arn == product_deleted_topic_arn {
        Ok(TopicArn::ProductDeleted)
    } else {
        Err(ApplicationError::InvalidTopic(message.topic_arn.clone()))
    }
}
