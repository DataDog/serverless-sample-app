use serde::Deserialize;
use thiserror::Error;

use crate::core::OrderingWorkflow;

#[derive(Error, Debug)]
pub enum ApplicationError {
    #[error("Error: {0}")]
    InternalError(String),
}

#[derive(Deserialize)]
pub struct ProductAddedEvent {
    product_id: String,
}

pub async fn handle_product_added_event<TEventPublisher: OrderingWorkflow>(
    workflow: &TEventPublisher,
    evt: ProductAddedEvent,
) -> Result<(), ApplicationError> {
    workflow
        .start_workflow_for(evt.product_id)
        .await
        .map_err(|_e| ApplicationError::InternalError("Failure starting workflow".to_string()))
}
