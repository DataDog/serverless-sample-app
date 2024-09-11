use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument}, Error, IntoResponse, Request, RequestExt,
};
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::{execute_get_product_query, ApplicationError, GetProductQuery};
use shared::response::{empty_response, json_response};
use std::env;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, Registry};

#[instrument(name = "GET /{productId}", skip(client, event), fields(api.method = event.method().as_str(), api.route = event.raw_http_path()))]
async fn function_handler<T: Repository>(
    client: &T,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    tracing::info!("Received event: {:?}", event);

    let product_id = event
        .path_parameters_ref()
        .and_then(|params| params.first("productId"))
        .unwrap_or("");

    if product_id.is_empty() {
        return empty_response(&StatusCode::NOT_FOUND);
    }

    let query = GetProductQuery::new(product_id.to_string());
    let result = execute_get_product_query(client, query).await;

    match result {
        Ok(product) => json_response(&StatusCode::OK, &product),
        Err(e) => match e {
            ApplicationError::NotFound => empty_response(&StatusCode::NOT_FOUND),
            ApplicationError::InvalidInput(_) => empty_response(&StatusCode::BAD_REQUEST),
            ApplicationError::InternalError(_) => empty_response(&StatusCode::INTERNAL_SERVER_ERROR)
        } ,
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let tracer = opentelemetry_datadog::new_pipeline()
        .with_service_name("RustProductApi")
        .with_agent_endpoint("http://127.0.0.1:8126")
        .with_api_version(opentelemetry_datadog::ApiVersion::Version05)
        .with_trace_config(
            opentelemetry_sdk::trace::config()
                .with_sampler(opentelemetry_sdk::trace::Sampler::AlwaysOn)
                .with_id_generator(opentelemetry_sdk::trace::RandomIdGenerator::default()),
        )
        .install_simple()
        .unwrap();
    let telemetry_layer = tracing_opentelemetry::layer().with_tracer(tracer);
    let logger = tracing_subscriber::fmt::layer().json().flatten_event(true);
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)
        .without_time();

    Registry::default()
        .with(fmt_layer)
        .with(telemetry_layer)
        .with(logger)
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let table_name = env::var("TABLE_NAME").expect("TABLE_NAME is not set");
    let config = aws_config::load_from_env().await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&config);
    let repository: DynamoDbRepository =
        DynamoDbRepository::new(dynamodb_client, table_name.clone());

    run(service_fn(|event| function_handler(&repository, event))).await
}
