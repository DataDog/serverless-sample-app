use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Error, IntoResponse, Request, RequestExt, RequestPayloadExt,
};
use observability::{observability, TracedMessage};
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::{handle_login, ApplicationError, LoginCommand};
use shared::response::{empty_response, json_response};
use shared::tokens::TokenGenerator;
use std::env;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "POST /user/login", skip(client, token_generator, event), fields(api.method = event.method().as_str(), api.route = event.raw_http_path()))]
async fn function_handler<TRepository: Repository>(
    client: &TRepository,
    token_generator: &TokenGenerator,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    let _: Result<TracedMessage, &str> = event.headers().try_into();
    tracing::info!("Received event: {:?}", event);

    let request_body = event.payload::<LoginCommand>()?;

    match request_body {
        None => empty_response(&StatusCode::BAD_REQUEST),
        Some(command) => {
            let result = handle_login(client, token_generator, command).await;

            match result {
                Ok(response) => json_response(&StatusCode::OK, &response),
                Err(e) => match e {
                    ApplicationError::NotFound => empty_response(&StatusCode::NOT_FOUND),
                    ApplicationError::InvalidInput(_) => empty_response(&StatusCode::BAD_REQUEST),
                    ApplicationError::InvalidPassword() => empty_response(&StatusCode::BAD_REQUEST),
                    ApplicationError::InternalError(_) => {
                        empty_response(&StatusCode::INTERNAL_SERVER_ERROR)
                    }
                },
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

    //TODO: Replace this with call to SSM and shared infra storing a shared key
    let secret = env::var("TOKEN_SECRET_KEY").expect("TOKEN_SECRET_KEY is not set");
    let expiration:  usize = env::var("TOKEN_EXPIRATION").unwrap_or(String::from("86400")).parse()?;

    let token_generator = TokenGenerator::new(secret, expiration);

    run(service_fn(|event| {
        function_handler(&repository, &token_generator, event)
    }))
    .await
}
