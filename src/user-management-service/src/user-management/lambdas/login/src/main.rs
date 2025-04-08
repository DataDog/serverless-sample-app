use aws_config::SdkConfig;
use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Error, IntoResponse, Request, RequestExt, RequestPayloadExt,
};
use observability::{observability, trace_request};
use opentelemetry::global::{self, ObjectSafeSpan};
use opentelemetry::trace::Tracer;
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::{handle_login, ApplicationError, LoginCommand};
use shared::response::{empty_response, json_response};
use shared::tokens::TokenGenerator;
use std::env;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "POST /login", skip(client, token_generator, event), fields(http.method = event.method().as_str(), http.path_group = event.raw_http_path()))]
async fn function_handler<TRepository: Repository>(
    client: &TRepository,
    token_generator: &TokenGenerator,
    event: Request,
) -> Result<impl IntoResponse, Error> {
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
                    ApplicationError::InvalidToken() => empty_response(&StatusCode::BAD_REQUEST),
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

    let secret = load_jwt_secret(&config)
        .await
        .expect("Failed to load JWT secret");
    let expiration: usize = env::var("TOKEN_EXPIRATION")
        .unwrap_or(String::from("86400"))
        .parse()?;

    let token_generator = TokenGenerator::new(secret, expiration);

    run(service_fn(|event| async {
        let tracer = global::tracer(env::var("DD_SERVICE").expect("DD_SERVICE is not set"));

        tracer.in_span("handle_request", async |_cx| {
            let mut handler_span = trace_request(&event);

            let res = function_handler(&repository, &token_generator, event).await;

            handler_span.end();

            res
        })
        .await
    }))
    .await
}

async fn load_jwt_secret(config: &SdkConfig) -> Result<String, ()> {
    let ssm_client = aws_sdk_ssm::Client::new(&config);
    let secret_key_name =
        std::env::var("JWT_SECRET_PARAM_NAME").expect("JWT_SECRET_PARAM_NAME name set");

    let jwt_secret_key = ssm_client
        .get_parameter()
        .with_decryption(true)
        .name(secret_key_name)
        .send()
        .await
        .expect("Failed to retrieve secret key")
        .parameter
        .expect("Secret key not found")
        .value
        .expect("Secret key value not found");

    Ok(jwt_secret_key)
}
