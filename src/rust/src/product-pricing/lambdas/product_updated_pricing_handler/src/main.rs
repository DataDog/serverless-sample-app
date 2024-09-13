use aws_lambda_events::sns::SnsEvent;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use observability::{observability, TracedMessage};
use pricing_core::adapters::SnsEventPublisher;
use pricing_core::core::EventPublisher;
use pricing_core::ports::handle_product_updated_event;
use tracing::instrument;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "handle-product-updated", skip(event_publisher, event))]
async fn function_handler<TEventPublisher: EventPublisher>(
    event_publisher: &TEventPublisher,
    event: LambdaEvent<SnsEvent>,
) -> Result<(), Error> {
    for sns_record in &event.payload.records {
        let traced_message: TracedMessage = sns_record.into();

        let evt = serde_json::from_str(&traced_message.message).unwrap();

        handle_product_updated_event(event_publisher, evt).await?;
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    observability().init();

    let config = aws_config::load_from_env().await;
    let sns_client = aws_sdk_sns::Client::new(&config);
    let event_publisher = SnsEventPublisher::new(sns_client);

    run(service_fn(|event| {
        function_handler(&event_publisher, event)
    }))
    .await
}
