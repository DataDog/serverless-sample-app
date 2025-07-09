use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Error, IntoResponse, Request, RequestExt,
};
use opentelemetry::global::ObjectSafeSpan;
use shared::response::{empty_response, json_response};

use aws_config::SdkConfig;
use observability::{observability, trace_request};
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::GetUserDetailsQuery;
use shared::tokens::TokenGenerator;
use std::env;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "GET /user/{userId}", skip(client, token_generator, event), fields(api.method = event.method().as_str(), api.route = event.raw_http_path()))]
async fn function_handler<TRepository: Repository>(
    client: &TRepository,
    token_generator: &TokenGenerator,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    tracing::info!("Received event: {:?}", event);

    let auth_header = event
        .headers()
        .get("Authorization")
        .ok_or("Authorization header not found")?;

    let user_id = event
        .path_parameters_ref()
        .and_then(|params| params.first("userId"));

    match user_id {
        None => empty_response(&StatusCode::BAD_REQUEST),
        Some(user_id) => {
            let is_valid_token =
                token_generator.validate_token(auth_header.to_str().unwrap(), user_id);

            match is_valid_token {
                Ok(_) => {
                    let query = GetUserDetailsQuery::new(user_id.to_string());

                    let result = query.handle(client).await;

                    match result {
                        Ok(response) => json_response(&StatusCode::OK, &response),
                        Err(e) => {
                            tracing::error!("Failed to retrieve user details: {:?}", e);
                            empty_response(&StatusCode::INTERNAL_SERVER_ERROR)
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Invalid token: {:?}", e);
                    empty_response(&StatusCode::UNAUTHORIZED)
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

    let secret = load_jwt_secret(&config)
        .await
        .expect("Failed to load JWT secret");
    println!("JWT secret value is {}", secret);

    let expiration: usize = env::var("TOKEN_EXPIRATION")
        .unwrap_or(String::from("86400"))
        .parse()?;

    let token_generator = TokenGenerator::new(secret, expiration);

    run(service_fn(|event: Request| async {
        let mut handler_span = trace_request(&event);

        let res = function_handler(&repository, &token_generator, event).await;

        handler_span.end();

        res
    }))
    .await
}

async fn load_jwt_secret(config: &SdkConfig) -> Result<String, ()> {
    let ssm_client = aws_sdk_ssm::Client::new(config);
    let secret_key_name =
        std::env::var("JWT_SECRET_PARAM_NAME").expect("JWT_SECRET_PARAM_NAME name not set");

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
