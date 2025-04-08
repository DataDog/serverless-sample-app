use std::env;

use aws_lambda_events::sqs::{SqsEvent, SqsMessage};
use lambda_runtime::{Error, LambdaEvent};
use observability::CloudEvent;
use opentelemetry::global::ObjectSafeSpan;
use opentelemetry::trace::{FutureExt, SpanKind, Tracer};
use opentelemetry::global;
use shared::core::Repository;
use shared::ports::OrderCompleted;

pub(crate) async fn function_handler<TRepository: Repository>(
    client: &TRepository,
    current_context: &opentelemetry::context::Context,
    event: LambdaEvent<SqsEvent>,
) -> Result<(), Error> {
    tracing::info!("Received event: {:?}", event);

    for sqs_message in &event.payload.records {
        process_message(current_context, client, sqs_message)
            .with_current_context()
            .await?;
    }

    Ok(())
}

async fn process_message<TRepository: Repository>(
    current_context: &opentelemetry::context::Context,
    client: &TRepository,
    sqs_message: &SqsMessage,
) -> Result<(), Error> {
    let tracer = global::tracer(env::var("DD_SERVICE").expect("DD_SERVICE is not set"));

    let mut span = tracer
        .span_builder("process order.orderCompleted.v1")
        .with_kind(SpanKind::Internal)
        .start_with_context(&tracer, current_context);

    let traced_message: CloudEvent<OrderCompleted> = sqs_message.into();

    let _ = match traced_message.data {
        Some(evt) => evt.handle(client).with_current_context().await,
        None => Err(shared::ports::ApplicationError::InternalError(
            "Failure parsing message body to valid event".to_string(),
        )),
    };

    span.end();

    Ok(())
}
