use aws_lambda_events::sqs::SqsEvent;
use dogstatsd::{Client, Options};
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use observability::{observability, TracedMessage};
use tracing::instrument;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "handle-analytics", skip(event))]
async fn function_handler(client: &Client, event: LambdaEvent<SqsEvent>) -> Result<(), Error> {
    for sqs_message in &event.payload.records {
        let traced_message: TracedMessage = sqs_message.into();

        let tags = &[format!(
            "env:{}",
            std::env::var("ENV").unwrap_or("dev".to_string())
        )];
        let _ = client.incr(
            traced_message
                .message_type
                .unwrap_or("Unknown message".to_string()),
            tags,
        );
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    observability().init();

    let client = Client::new(Options::default()).unwrap();

    run(service_fn(|event| function_handler(&client, event))).await
}
