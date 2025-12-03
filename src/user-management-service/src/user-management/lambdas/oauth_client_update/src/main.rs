use lambda_http::http::StatusCode;
use lambda_http::{
    Error, IntoResponse, Request, RequestExt, RequestPayloadExt, run, service_fn,
    tracing::{self, instrument},
};
use observability::init_otel;
use opentelemetry_sdk::trace::SdkTracerProvider;
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::{ApplicationError, UpdateOAuthClientCommand};
use shared::response::{empty_response, json_response};
use std::env;
use std::sync::OnceLock;

#[instrument(name = "PUT /oauth/clients/{client_id}", skip(repository, event), fields(http.method = event.method().as_str(), http.path_group = event.raw_http_path()))]
async fn function_handler<TRepository: Repository>(
    repository: &TRepository,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    tracing::info!("Received event: {:?}", event);

    // Extract client_id from path parameters
    let client_id = event
        .path_parameters()
        .first("clientId")
        .unwrap_or_default()
        .to_string();

    if client_id.is_empty() {
        return empty_response(&StatusCode::BAD_REQUEST);
    }

    let request_body = event.payload::<UpdateOAuthClientCommand>()?;

    match request_body {
        None => empty_response(&StatusCode::BAD_REQUEST),
        Some(mut command) => {
            // Set the client_id from the path parameter
            command.client_id = client_id;

            let result = command.handle(repository).await;

            match result {
                Ok(response) => json_response(&StatusCode::OK, &response),
                Err(e) => match e {
                    ApplicationError::NotFound => empty_response(&StatusCode::NOT_FOUND),
                    ApplicationError::InvalidInput(_) => empty_response(&StatusCode::BAD_REQUEST),
                    ApplicationError::InvalidPassword() => empty_response(&StatusCode::BAD_REQUEST),
                    ApplicationError::InvalidToken() => empty_response(&StatusCode::BAD_REQUEST),
                    ApplicationError::InternalError(_) => {
                        empty_response(&StatusCode::INTERNAL_SERVER_ERROR)
                    }
                },
            }
        }
    }
}

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

    run(service_fn(|event| async {
        let res = function_handler(&repository, event).await;

        if let Some(provider) = TRACER_PROVIDER.get()
            && let Err(e) = provider.force_flush()
        {
            tracing::warn!("Failed to flush traces: {:?}", e);
        }

        res
    }))
    .await
}
