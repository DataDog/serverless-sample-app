use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Error, IntoResponse, Request, RequestExt,
};
use observability::{observability, TracedMessage};
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::{execute_list_products_query, ApplicationError, ListProductsQuery};
use shared::response::{empty_response, json_response};
use std::env;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "GET /", skip(client, event), fields(api.method = event.method().as_str(), api.route = event.raw_http_path()))]
async fn function_handler<T: Repository>(
    client: &T,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    let _: Result<TracedMessage, &str> = event.headers().try_into();

    tracing::info!("Received event: {:?}", event);

    let query = ListProductsQuery::new();
    let result = execute_list_products_query(client, query).await;

    match result {
        Ok(product) => json_response(&StatusCode::OK, &product),
        Err(e) => match e {
            ApplicationError::NotFound => empty_response(&StatusCode::NOT_FOUND),
            ApplicationError::InvalidInput(_) => empty_response(&StatusCode::BAD_REQUEST),
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

    run(service_fn(|event| function_handler(&repository, event))).await
}
