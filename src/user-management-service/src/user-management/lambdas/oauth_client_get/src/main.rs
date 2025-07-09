use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Error, IntoResponse, Request, RequestExt,
};
use observability::observability;
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::{GetOAuthClientQuery, ApplicationError};
use shared::response::{empty_response, json_response};
use std::env;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "GET /oauth/clients/{client_id}", skip(repository, event), fields(http.method = event.method().as_str(), http.path_group = event.raw_http_path()))]
async fn function_handler<TRepository: Repository>(
    repository: &TRepository,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    tracing::info!("Received event: {:?}", event);

    // Extract client_id from path parameters
    let client_id = event
        .path_parameters()
        .first("client_id")
        .unwrap_or_default()
        .to_string();

    if client_id.is_empty() {
        return empty_response(&StatusCode::BAD_REQUEST);
    }

    let query = GetOAuthClientQuery { client_id };
    let result = query.handle(repository).await;

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

#[tokio::main]
async fn main() -> Result<(), Error> {
    observability().init();
    let table_name = env::var("TABLE_NAME").expect("TABLE_NAME is not set");
    let config = aws_config::load_from_env().await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&config);
    let repository: DynamoDbRepository =
        DynamoDbRepository::new(dynamodb_client, table_name.clone());

    run(service_fn(|event| {
        function_handler(&repository, event)
    }))
    .await
}
