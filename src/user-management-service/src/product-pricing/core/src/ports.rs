use crate::core::{EventPublisher, PricingService, ProductPricingChangedEvent};
use serde::Deserialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ApplicationError {
    #[error("Error: {0}")]
    InternalError(String),
}

#[derive(Deserialize)]
pub struct ProductCreatedEvent {
    product_id: String,
    price: f32,
}

pub async fn handle_product_created_event<TEventPublisher: EventPublisher>(
    event_publisher: &TEventPublisher,
    evt: ProductCreatedEvent,
) -> Result<(), ApplicationError> {
    let price_breakdowns = PricingService::calculate_pricing_for(evt.price);

    event_publisher
        .publish_product_pricing_changed_event(ProductPricingChangedEvent::new(
            evt.product_id,
            price_breakdowns,
        ))
        .await
        .map_err(|_e| ApplicationError::InternalError("Failure publishing event".to_string()))
}

#[derive(Deserialize)]
pub struct ProductUpdatedEvent {
    product_id: String,
    new: ProductDetails,
}

#[derive(Deserialize)]
struct ProductDetails {
    price: f32,
}

pub async fn handle_product_updated_event<TEventPublisher: EventPublisher>(
    event_publisher: &TEventPublisher,
    evt: ProductUpdatedEvent,
) -> Result<(), ApplicationError> {
    let price_breakdowns = PricingService::calculate_pricing_for(evt.new.price);

    event_publisher
        .publish_product_pricing_changed_event(ProductPricingChangedEvent::new(
            evt.product_id,
            price_breakdowns,
        ))
        .await
        .map_err(|_e| ApplicationError::InternalError("Failure publishing event".to_string()))
}
