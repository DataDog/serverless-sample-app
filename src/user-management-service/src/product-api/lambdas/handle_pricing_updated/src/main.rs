use aws_lambda_events::sns::SnsEvent;
use lambda_runtime::tracing::instrument;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use observability::{observability, TracedMessage};
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::handle_pricing_updated_event;
use std::env;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "handle-pricing-updated", skip(client, event))]
async fn function_handler<TRepository: Repository>(
    client: &TRepository,
    event: LambdaEvent<SnsEvent>,
) -> Result<(), Error> {
    for sns_record in &event.payload.records {
        let traced_message: TracedMessage = sns_record.into();
        let evt = serde_json::from_str(&traced_message.message).unwrap();

        handle_pricing_updated_event(client, evt)
            .await
            .map_err(|e| {
                tracing::error!("{}", e);

                e
            })?;
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
