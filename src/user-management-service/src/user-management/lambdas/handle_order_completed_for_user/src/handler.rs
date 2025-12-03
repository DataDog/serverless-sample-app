use aws_lambda_events::sqs::{SqsEvent, SqsMessage};
use lambda_runtime::{Error, LambdaEvent};
use observability::CloudEvent;
use shared::core::Repository;
use shared::ports::OrderCompleted;
use tracing::{Span, instrument};
use tracing_opentelemetry::OpenTelemetrySpanExt;

#[instrument(name = "handle_order_completed", skip(client, event))]
pub(crate) async fn function_handler<TRepository: Repository>(
    client: &TRepository,
    parent_span: Span,
    event: LambdaEvent<SqsEvent>,
) -> Result<(), Error> {
    tracing::info!("Received event: {:?}", event);
    let current_span = Span::current();
    let _ = current_span.set_parent(parent_span.context());

    for sqs_message in &event.payload.records {
        process_message(client, &current_span, sqs_message).await?;
    }

    Ok(())
}

#[instrument(name = "process orders.orderCompleted.v1", skip(client, sqs_message))]
async fn process_message<TRepository: Repository>(
    client: &TRepository,
    parent_span: &Span,
    sqs_message: &SqsMessage,
) -> Result<(), Error> {
    let current_span = Span::current();
    let _ = current_span.set_parent(parent_span.context());
    current_span.set_attribute(
        "messaging.message.id",
        sqs_message.message_id.clone().unwrap_or("".to_string()),
    );

    let traced_message: CloudEvent<OrderCompleted> = sqs_message.into();

    let _ = match traced_message.data {
        Some(evt) => evt.handle(client).await,
        None => Err(shared::ports::ApplicationError::InternalError(
            "Failure parsing message body to valid event".to_string(),
        )),
    };

    Ok(())
}
