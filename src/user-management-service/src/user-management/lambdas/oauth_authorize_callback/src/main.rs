use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Error, Request, RequestExt, RequestPayloadExt, Response, Body,
};
use observability::observability;
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::{AuthorizeCallbackCommand, ApplicationError};
use shared::response::{empty_response, redirect_response};
use std::env;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "OAuth authorize callback", skip(repository, event), fields(http.method = event.method().as_str(), http.path_group = event.raw_http_path()))]
async fn function_handler<TRepository: Repository>(
    repository: &TRepository,
    event: Request,
) -> Result<Response<Body>, Error> {
    tracing::info!("Received OAuth authorize callback event: {:?}", event);

    match event.method().as_str() {
        "GET" => handle_callback_get(repository, event).await,
        "POST" => handle_callback_post(repository, event).await,
        _ => empty_response(&StatusCode::METHOD_NOT_ALLOWED),
    }
}

async fn handle_callback_get<TRepository: Repository>(
    _repository: &TRepository,
    event: Request,
) -> Result<Response<Body>, Error> {
    // Extract query parameters (code, state, error, etc.)
    let query_params = event.query_string_parameters();
    
    let code = query_params.first("code");
    let state = query_params.first("state");
    let error = query_params.first("error");
    
    if let Some(error) = error {
        // OAuth error response
        tracing::error!("OAuth error received: {}", error);
        return empty_response(&StatusCode::BAD_REQUEST);
    }
    
    let code = code.ok_or_else(|| {
        tracing::error!("No authorization code received");
        "Missing authorization code".to_string()
    })?;
    
    // This endpoint is typically called by the client application to retrieve the authorization code
    // In a real implementation, you might redirect to a success page or return the code to the client
    tracing::info!("Authorization code received: {}", code);
    
    // For demonstration, we'll return a simple success response
    // In practice, this would be handled by the client application
    let success_message = format!("Authorization successful. Code: {} State: {:?}", code, state);
    
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "text/plain")
        .body(Body::Text(success_message))
        .map_err(Box::new)?)
}

async fn handle_callback_post<TRepository: Repository>(
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
                    // Redirect to client with authorization code
                    redirect_response(&StatusCode::FOUND, &response.redirect_url)
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
