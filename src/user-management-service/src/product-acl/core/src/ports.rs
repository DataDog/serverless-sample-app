use thiserror::Error;

use crate::core::{AntiCorruptionLayer, EventPublisher};
use crate::public_events::InventoryStockUpdatedEventV1;

#[derive(Error, Debug)]
pub enum ApplicationError {
    #[error("Error: {0}")]
    InternalError(String),
}

pub async fn handle_stock_updated_event<TEventPublisher: EventPublisher>(
    event_publisher: &TEventPublisher,
    evt: InventoryStockUpdatedEventV1,
) -> Result<(), ApplicationError> {
    let stock_updated_event = AntiCorruptionLayer::translate_inventory_stock_updated_event(evt);

    event_publisher
        .publish_stock_updated_event(stock_updated_event)
        .await
        .map_err(|_e| ApplicationError::InternalError("Failure publishing event".to_string()))?;

    Ok(())
}
