use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Error, IntoResponse, Request, RequestExt, RequestPayloadExt, Response, Body,
};
use observability::observability;
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::{AuthorizeRequest, AuthorizeCallbackCommand, ApplicationError};
use shared::response::{empty_response, json_response};
use std::env;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "GET /oauth/authorize", skip(repository, event), fields(http.method = event.method().as_str(), http.path_group = event.raw_http_path()))]
async fn function_handler<TRepository: Repository>(
    repository: &TRepository,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    tracing::info!("Received event: {:?}", event);

    match event.method().as_str() {
        "GET" => handle_authorize_get(repository, event).await,
        "POST" => handle_authorize_post(repository, event).await,
        _ => empty_response(&StatusCode::METHOD_NOT_ALLOWED),
    }
}

async fn handle_authorize_get<TRepository: Repository>(
    repository: &TRepository,
    event: Request,
) -> Result<Response<Body>, Error> {
    let query_params = event.query_string_parameters();
    
    let authorize_request = AuthorizeRequest {
        response_type: query_params.first("response_type").unwrap_or("").to_string(),
        client_id: query_params.first("client_id").unwrap_or("").to_string(),
        redirect_uri: query_params.first("redirect_uri").unwrap_or("").to_string(),
        scope: query_params.first("scope").map(|s| s.to_string()),
        state: query_params.first("state").map(|s| s.to_string()),
        code_challenge: query_params.first("code_challenge").map(|s| s.to_string()),
        code_challenge_method: query_params.first("code_challenge_method").map(|s| s.to_string()),
    };

    let result = authorize_request.handle(repository).await;

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

async fn handle_authorize_post<TRepository: Repository>(
    repository: &TRepository,
    event: Request,
) -> Result<Response<Body>, Error> {
    let request_body = event.payload::<AuthorizeCallbackCommand>()?;

    match request_body {
        None => empty_response(&StatusCode::BAD_REQUEST),
        Some(command) => {
            let result = command.handle(repository).await;

            match result {
                Ok(response) => {
                    // Return redirect response
                    Ok(Response::builder()
                        .status(StatusCode::FOUND)
                        .header("Location", &response.redirect_url)
                        .body(Body::Empty)
                        .unwrap())
                }
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

    run(service_fn(|event| {
        function_handler(&repository, event)
    }))
    .await
}
