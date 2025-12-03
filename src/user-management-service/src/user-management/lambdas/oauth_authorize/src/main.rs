use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self},
    Body, Error, IntoResponse, Request, RequestExt, RequestPayloadExt, Response,
};
use observability::init_otel;
use std::sync::OnceLock;
use opentelemetry_sdk::trace::SdkTracerProvider;
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::{
    ApplicationError, AuthorizeCallbackCommand, AuthorizeRequest, LoginFormCommand,
};
use shared::response::{empty_response, html_response, redirect_response};
use std::env;
use tracing::instrument;

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

#[instrument(name = "handle_authorize_get", skip(repository, event))]
async fn handle_authorize_get<TRepository: Repository>(
    repository: &TRepository,
    event: Request,
) -> Result<Response<Body>, Error> {
    let query_params = event.query_string_parameters();

    let authorize_request = AuthorizeRequest {
        response_type: query_params
            .first("response_type")
            .unwrap_or("")
            .to_string(),
        client_id: query_params.first("client_id").unwrap_or("").to_string(),
        redirect_uri: query_params.first("redirect_uri").unwrap_or("").to_string(),
        scope: query_params.first("scope").map(|s| s.to_string()),
        state: query_params.first("state").map(|s| s.to_string()),
        code_challenge: query_params.first("code_challenge").map(|s| s.to_string()),
        code_challenge_method: query_params
            .first("code_challenge_method")
            .map(|s| s.to_string()),
    };

    let result = authorize_request.handle_html(repository).await;

    match result {
        Ok(response) => html_response(&StatusCode::OK, &response.html_content),
        Err(e) => {
            tracing::error!("Error handling authorize request: {:?}", e);
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

#[instrument(name = "handle_authorize_post", skip(repository, event))]
async fn handle_authorize_post<TRepository: Repository>(
    repository: &TRepository,
    event: Request,
) -> Result<Response<Body>, Error> {
    // Check if it's a login form submission (form-encoded) or callback (JSON)
    let content_type = event
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if content_type.contains("application/x-www-form-urlencoded") {
        // Handle login form submission
        handle_login_form_post(repository, event).await
    } else {
        // Handle existing callback (JSON)
        handle_callback_post(repository, event).await
    }
}

#[instrument(name = "handle_login_form_post", skip(repository, event))]
async fn handle_login_form_post<TRepository: Repository>(
    repository: &TRepository,
    event: Request,
) -> Result<Response<Body>, Error> {
    use lambda_http::Body;
    use std::str;

    // Parse form data
    let body = match event.body() {
        Body::Text(text) => text,
        Body::Binary(bytes) => str::from_utf8(bytes).unwrap_or(""),
        _ => return empty_response(&StatusCode::BAD_REQUEST),
    };

    let form_data: std::collections::HashMap<String, String> = body
        .split('&')
        .filter_map(|pair| {
            let mut parts = pair.split('=');
            if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
                Some((
                    urlencoding::decode(key).unwrap_or_default().to_string(),
                    urlencoding::decode(value).unwrap_or_default().to_string(),
                ))
            } else {
                None
            }
        })
        .collect();

    let login_command = LoginFormCommand {
        email: form_data.get("email").unwrap_or(&"".to_string()).clone(),
        password: form_data.get("password").unwrap_or(&"".to_string()).clone(),
        client_id: form_data
            .get("client_id")
            .unwrap_or(&"".to_string())
            .clone(),
        redirect_uri: form_data
            .get("redirect_uri")
            .unwrap_or(&"".to_string())
            .clone(),
        scope: form_data.get("scope").unwrap_or(&"".to_string()).clone(),
        state: form_data.get("state").unwrap_or(&"".to_string()).clone(),
        code_challenge: form_data
            .get("code_challenge")
            .unwrap_or(&"".to_string())
            .clone(),
        code_challenge_method: form_data
            .get("code_challenge_method")
            .unwrap_or(&"".to_string())
            .clone(),
        csrf_token: form_data
            .get("csrf_token")
            .unwrap_or(&"".to_string())
            .clone(),
        action: form_data.get("action").unwrap_or(&"".to_string()).clone(),
    };

    let result = login_command.handle(repository).await;

    match result {
        Ok(response) => {
            if response.success {
                // Redirect to client with authorization code
                tracing::info!(
                    "Redirecting to: {}",
                    &response.redirect_url.clone().unwrap_or_default()
                );
                redirect_response(
                    &StatusCode::FOUND,
                    &response.redirect_url.unwrap_or_default(),
                )
            } else {
                tracing::error!("Login failed");
                // Return HTML login page with error
                html_response(&StatusCode::OK, &response.html_content.unwrap_or_default())
            }
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

#[instrument(name = "handle_callback_post", skip(repository, event))]
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
                    // Return redirect response
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

static TRACER_PROVIDER: OnceLock<SdkTracerProvider> = OnceLock::new();

#[tokio::main]
async fn main() -> Result<(), Error> {
    let otel_providers = match init_otel() {
        Ok(providers) => Some(providers),
        Err(err) => {
            tracing::warn!(
                "Couldn't start OTel! Will proudly soldier on without telemetry: {0}",
                err
            );
            None
        }
    };

    let _ = TRACER_PROVIDER.set(otel_providers.unwrap().0);
    let table_name = env::var("TABLE_NAME").expect("TABLE_NAME is not set");
    let config = aws_config::load_from_env().await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&config);
    let repository: DynamoDbRepository =
        DynamoDbRepository::new(dynamodb_client, table_name.clone());

    run(service_fn(|event| async {
        let res = function_handler(&repository, event).await;

        if let Some(provider) = TRACER_PROVIDER.get() {
            if let Err(e) = provider.force_flush() {
                tracing::warn!("Failed to flush traces: {:?}", e);
            }
        }

        res
    }))
    .await
}
