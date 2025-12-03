use aws_lambda_events::sqs::SqsEvent;
use handler::function_handler;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use observability::{init_otel, trace_handler};
use std::sync::OnceLock;
use opentelemetry_sdk::trace::SdkTracerProvider;
use shared::adapters::DynamoDbRepository;
use std::env;
use opentelemetry::global::ObjectSafeSpan;

mod handler;

static TRACER_PROVIDER: OnceLock<SdkTracerProvider> = OnceLock::new();

#[tokio::main]
async fn main() -> Result<(), Error> {
    let otel_providers = match init_otel() {
        Ok(providers) => Some(providers),
        Err(err) => {
            tracing::warn!(
                "Couldn't start OTel! Will proudly soldier on without telemetry: {0}",
                err
            );
            None
        }
    };

    let _ = TRACER_PROVIDER.set(otel_providers.unwrap().0);
    let table_name = env::var("TABLE_NAME").expect("TABLE_NAME is not set");
    let config = aws_config::load_from_env().await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&config);
    let repository: DynamoDbRepository =
        DynamoDbRepository::new(dynamodb_client, table_name.clone());

    run(service_fn(|event: LambdaEvent<SqsEvent>| async {
        let mut lambda_span = trace_handler(event.context.clone());
        let current_span = tracing::Span::current();

        let res = function_handler(&repository, current_span, event).await;

        lambda_span.end();

        if let Some(provider) = TRACER_PROVIDER.get()
            && let Err(e) = provider.force_flush() {
                tracing::warn!("Failed to flush traces: {:?}", e);
            }

        res
    })).await
}
