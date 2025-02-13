use thiserror::Error;

use crate::{
    core::{AntiCorruptionLayer, EventPublisher},
    public_events::ProductCreatedEvent,
};

#[derive(Error, Debug)]
pub enum ApplicationError {
    #[error("Error: {0}")]
    InternalError(String),
}

pub async fn handle_product_created_event<TEventPublisher: EventPublisher>(
    event_publisher: &TEventPublisher,
    evt: ProductCreatedEvent,
) -> Result<(), ApplicationError> {
    let product_added_event = AntiCorruptionLayer::translate_product_created_event(evt);

    event_publisher
        .publish_product_added_event(product_added_event)
        .await
        .map_err(|_e| ApplicationError::InternalError("Failure publishing event".to_string()))?;

    Ok(())
}
