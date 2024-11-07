use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Error, IntoResponse, Request, RequestExt, RequestPayloadExt,
};
use opentelemetry::global::{BoxedSpan, ObjectSafeSpan};
use opentelemetry::trace::{TraceContextExt, Tracer};
use opentelemetry::{global, Context, KeyValue};
use shared::response::{empty_response, json_response};

use observability::{observability, trace_request, TracedMessage};
use shared::adapters::{DynamoDbRepository, SnsEventPublisher};
use shared::core::{EventPublisher, Repository};
use shared::ports::{handle_create_product, CreateProductCommand};
use std::env;
use std::sync::Arc;
use tracing::Span;
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "POST /", skip(client, event_publisher, event), fields(api.method = event.method().as_str(), api.route = event.raw_http_path()))]
async fn function_handler<TRepository: Repository, TEventPublisher: EventPublisher>(
    client: &TRepository,
    event_publisher: &TEventPublisher,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    let _: Result<TracedMessage, &str> = event.headers().try_into();

    tracing::info!("Received event: {:?}", event);

    let request_body = event.payload::<CreateProductCommand>()?;

    match request_body {
        None => empty_response(&StatusCode::BAD_REQUEST),
        Some(command) => {
            let result = handle_create_product(client, event_publisher, command).await;

            match result {
                Ok(response) => json_response(&StatusCode::OK, &response),
                Err(e) => {
                    tracing::error!("Failed to create product: {:?}", e);
                    empty_response(&StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    observability().init();

    let table_name = env::var("TABLE_NAME").expect("TABLE_NAME is not set");
    let config = aws_config::load_from_env().await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&config);
    let repository: DynamoDbRepository =
        DynamoDbRepository::new(dynamodb_client, table_name.clone());

    let sns_client = aws_sdk_sns::Client::new(&config);
    let event_publisher = SnsEventPublisher::new(sns_client);

    run(service_fn(|event: Request| async {
        let mut handler_span = trace_request(&event);

        let res = function_handler(&repository, &event_publisher, event).await;

        unsafe {
            observability::IS_COLD_START = 0;
        }

        handler_span.end();

        res
    }))
    .await
}
