use aws_config::SdkConfig;
use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Error, IntoResponse, Request, RequestExt, RequestPayloadExt,
};
use observability::observability;
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::{ApplicationError, TokenRequest};
use shared::response::{empty_response, json_response};
use shared::tokens::TokenGenerator;
use std::env;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "POST /oauth/token", skip(repository, token_generator, event), fields(http.method = event.method().as_str(), http.path_group = event.raw_http_path()))]
async fn function_handler<TRepository: Repository>(
    repository: &TRepository,
    token_generator: &TokenGenerator,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    tracing::info!("Received event: {:?}", event);

    // OAuth token requests can come as form data or JSON
    let token_request = if let Some(content_type) = event.headers().get("content-type") {
        if content_type
            .to_str()
            .unwrap_or("")
            .contains("application/x-www-form-urlencoded")
        {
            // Parse form data
            let body = event.body();
            let body_str = std::str::from_utf8(body).unwrap_or("");
            parse_form_data(body_str)
        } else {
            // Parse JSON
            match event.payload::<TokenRequest>()? {
                Some(request) => request,
                None => return empty_response(&StatusCode::BAD_REQUEST),
            }
        }
    } else {
        // Try JSON by default
        match event.payload::<TokenRequest>()? {
            Some(request) => request,
            None => return empty_response(&StatusCode::BAD_REQUEST),
        }
    };

    let result = token_request.handle(repository, token_generator).await;

    match result {
        Ok(response) => json_response(&StatusCode::OK, &response),
        Err(e) => {
            tracing::error!("Error handling token request: {:?}", e);
            match e {
                ApplicationError::NotFound => empty_response(&StatusCode::NOT_FOUND),
                ApplicationError::InvalidInput(_) => empty_response(&StatusCode::BAD_REQUEST),
                ApplicationError::InvalidPassword() => empty_response(&StatusCode::BAD_REQUEST),
                ApplicationError::InvalidToken() => empty_response(&StatusCode::BAD_REQUEST),
                ApplicationError::InternalError(_) => {
                    empty_response(&StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        }
    }
}

fn parse_form_data(body: &str) -> TokenRequest {
    let mut grant_type = String::new();
    let mut code = None;
    let mut redirect_uri = None;
    let mut client_id = String::new();
    let mut client_secret = None;
    let mut refresh_token = None;
    let mut scope = None;
    let mut code_verifier = None;

    for pair in body.split('&') {
        let parts: Vec<&str> = pair.split('=').collect();
        if parts.len() == 2 {
            let key = parts[0];
            let value = parts[1].replace("+", " "); // Basic URL decoding

            match key {
                "grant_type" => grant_type = value,
                "code" => code = Some(value),
                "redirect_uri" => redirect_uri = Some(value),
                "client_id" => client_id = value,
                "client_secret" => client_secret = Some(value),
                "refresh_token" => refresh_token = Some(value),
                "scope" => scope = Some(value),
                "code_verifier" => code_verifier = Some(value),
                _ => {}
            }
        }
    }

    TokenRequest {
        grant_type,
        code,
        redirect_uri,
        client_id,
        client_secret,
        refresh_token,
        scope,
        code_verifier,
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

    run(service_fn(|event| {
        function_handler(&repository, &token_generator, event)
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
