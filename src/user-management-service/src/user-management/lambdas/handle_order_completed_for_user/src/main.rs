use aws_lambda_events::sqs::SqsEvent;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use observability::{observability, CloudEvent};
use serde::{Deserialize, Serialize};
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::OrderCompleted;
use std::env;
use tracing::instrument;
use tracing_subscriber::util::SubscriberInitExt;

#[derive(Debug, Deserialize, Serialize)]
struct WrappedMessage {
    data: String,
}

#[instrument(name = "function_handler", skip(client, event))]
async fn function_handler<TRepository: Repository>(
    client: &TRepository,
    event: LambdaEvent<SqsEvent>,
) -> Result<(), Error> {
    tracing::info!("Received event: {:?}", event);

    for sqs_message in &event.payload.records {
        let traced_message: CloudEvent = sqs_message.into();

        let order_completed_event: OrderCompleted =
            serde_json::from_str(&traced_message.data).unwrap();

        order_completed_event.handle(client).await?;
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    observability().init();
    let table_name = env::var("TABLE_NAME").expect("TABLE_NAME is not set");
    let config = aws_config::load_from_env().await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&config);
    let repository: DynamoDbRepository =
        DynamoDbRepository::new(dynamodb_client, table_name.clone());

    run(service_fn(|event| function_handler(&repository, event))).await
}
