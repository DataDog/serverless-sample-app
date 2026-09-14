use aws_config::SdkConfig;
use lambda_http::http::StatusCode;
use lambda_http::{
    Error, IntoResponse, Request, RequestExt, RequestPayloadExt, run, service_fn,
    tracing::{self, instrument},
};
use observability::init_otel;
use opentelemetry_sdk::trace::SdkTracerProvider;
use shared::adapters::DynamoDbRepository;
use shared::core::Repository;
use shared::ports::{ApplicationError, CreateOAuthClientCommand};
use shared::response::{empty_response, raw_json_response};
use shared::tokens::TokenGenerator;
use std::env;
use std::sync::OnceLock;

#[instrument(name = "POST /oauth/register", skip(repository, token_generator, event), fields(http.method = event.method().as_str(), http.path_group = event.raw_http_path()))]
async fn function_handler<TRepository: Repository>(
    repository: &TRepository,
    token_generator: &TokenGenerator,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    let auth_header = match event.headers().get("Authorization") {
        Some(header) => header,
        None => return empty_response(&StatusCode::UNAUTHORIZED),
    };
    if token_generator
        .validate_admin_token(auth_header.to_str().unwrap_or(""))
        .is_err()
    {
        return empty_response(&StatusCode::FORBIDDEN);
    }

    let request_body = event.payload::<CreateOAuthClientCommand>()?;

    match request_body {
        None => empty_response(&StatusCode::BAD_REQUEST),
        Some(command) => {
            let result: Result<shared::core::OAuthClientCreatedDTO, ApplicationError> =
                command.handle(repository).await;

            match result {
                Ok(response) => raw_json_response(&StatusCode::CREATED, &response),
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

    if let Some(providers) = otel_providers {
        let _ = TRACER_PROVIDER.set(providers.0);
    }
    let table_name = env::var("TABLE_NAME").expect("TABLE_NAME is not set");
    let config = aws_config::load_from_env().await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&config);
    let repository: DynamoDbRepository =
        DynamoDbRepository::new(dynamodb_client, table_name.clone());
    let secret = load_jwt_secret(&config)
        .await
        .expect("Failed to load JWT secret");
    let token_generator = TokenGenerator::new(secret, 86400);

    run(service_fn(|event| async {
        let res = function_handler(&repository, &token_generator, event).await;

        if let Some(provider) = TRACER_PROVIDER.get()
            && let Err(e) = provider.force_flush()
        {
            tracing::warn!("Failed to flush traces: {:?}", e);
        }

        res
    }))
    .await
}

async fn load_jwt_secret(config: &SdkConfig) -> Result<String, ()> {
    let parameter_name =
        env::var("JWT_SECRET_PARAM_NAME").expect("JWT_SECRET_PARAM_NAME is not set");
    let value = aws_sdk_ssm::Client::new(config)
        .get_parameter()
        .with_decryption(true)
        .name(parameter_name)
        .send()
        .await
        .expect("Failed to retrieve JWT secret")
        .parameter
        .and_then(|parameter| parameter.value)
        .expect("JWT secret value not found");
    Ok(value)
}
