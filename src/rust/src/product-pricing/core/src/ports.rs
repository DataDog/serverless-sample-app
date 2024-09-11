use crate::core::{EventPublisher, PricingService, ProductPricingChangedEvent};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct ProductCreatedEvent {
    product_id: String,
    price: f32,
}

pub async fn handle_product_created_event<TEventPublisher: EventPublisher>(
    event_publisher: &TEventPublisher,
    evt: ProductCreatedEvent,
) {
    let price_breakdowns = PricingService::calculate_pricing_for(evt.price);

    event_publisher
        .publish_product_pricing_changed_event(ProductPricingChangedEvent::new(
            evt.product_id,
            price_breakdowns,
        ))
        .await;
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
) {
    let price_breakdowns = PricingService::calculate_pricing_for(evt.new.price);

    event_publisher
        .publish_product_pricing_changed_event(ProductPricingChangedEvent::new(
            evt.product_id,
            price_breakdowns,
        ))
        .await;
}
