use lambda_http::http::StatusCode;
use lambda_http::{
    Error, IntoResponse, Request, RequestExt, RequestPayloadExt, tracing::instrument,
};
use shared::response::{empty_response, json_response};

use shared::core::{EventPublisher, Repository};
use shared::ports::CreateUserCommand;

#[instrument(name = "POST /user", skip(client, event_publisher, event), fields(api.method = event.method().as_str(), api.route = event.raw_http_path()))]
pub(super) async fn function_handler<TRepository: Repository, TEventPublisher: EventPublisher>(
    client: &TRepository,
    event_publisher: &TEventPublisher,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    lambda_http::tracing::info!("Received event: {:?}", event);

    let request_body = event.payload::<CreateUserCommand>()?;

    match request_body {
        None => empty_response(&StatusCode::BAD_REQUEST),
        Some(command) => {
            let result = command.handle(client, event_publisher).await;

            match result {
                Ok(response) => json_response(&StatusCode::OK, &response),
                Err(e) => {
                    lambda_http::tracing::error!("Failed to create product: {:?}", e);
                    empty_response(&StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        }
    }
}
