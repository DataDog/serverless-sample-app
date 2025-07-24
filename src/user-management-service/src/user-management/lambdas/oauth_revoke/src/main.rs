use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Error, IntoResponse, Request, RequestExt, RequestPayloadExt,
};
use observability::observability;
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::{RevokeTokenRequest, ApplicationError};
use shared::response::empty_response;
use std::env;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "POST /oauth/revoke", skip(repository, event), fields(http.method = event.method().as_str(), http.path_group = event.raw_http_path()))]
async fn function_handler<TRepository: Repository>(
    repository: &TRepository,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    tracing::info!("Received event: {:?}", event);

    // OAuth revoke requests can come as form data or JSON
    let revoke_request = if let Some(content_type) = event.headers().get("content-type") {
        if content_type.to_str().unwrap_or("").contains("application/x-www-form-urlencoded") {
            // Parse form data
            let body = event.body();
            let body_str = std::str::from_utf8(body).unwrap_or("");
            parse_form_data(body_str)
        } else {
            // Parse JSON
            match event.payload::<RevokeTokenRequest>()? {
                Some(request) => request,
                None => return empty_response(&StatusCode::BAD_REQUEST),
            }
        }
    } else {
        // Try JSON by default
        match event.payload::<RevokeTokenRequest>()? {
            Some(request) => request,
            None => return empty_response(&StatusCode::BAD_REQUEST),
        }
    };

    let result = revoke_request.handle(repository).await;

    match result {
        Ok(_) => empty_response(&StatusCode::OK), // OAuth revoke returns 200 OK with empty body
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

fn parse_form_data(body: &str) -> RevokeTokenRequest {
    let mut token = String::new();
    let mut token_type_hint = None;
    let mut client_id = String::new();
    let mut client_secret = None;

    for pair in body.split('&') {
        let parts: Vec<&str> = pair.split('=').collect();
        if parts.len() == 2 {
            let key = parts[0];
            let value = parts[1].replace("+", " "); // Basic URL decoding

            match key {
                "token" => token = value,
                "token_type_hint" => token_type_hint = Some(value),
                "client_id" => client_id = value,
                "client_secret" => client_secret = Some(value),
                _ => {}
            }
        }
    }

    RevokeTokenRequest {
        token,
        token_type_hint,
        client_id,
        client_secret,
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
