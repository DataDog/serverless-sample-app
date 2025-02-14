use async_trait::async_trait;
use serde::Serialize;

use crate::public_events::ProductCreatedEvent;

#[async_trait]
pub trait EventPublisher {
    async fn publish_product_added_event(
        &self,
        product_added_evt: ProductAddedEvent,
    ) -> Result<(), ()>;
}

#[derive(Serialize)]
pub struct ProductAddedEvent {
    product_id: String,
}

impl ProductAddedEvent {
    pub(crate) fn new(product_id: String) -> Self {
        Self { product_id }
    }
}

pub(crate) struct AntiCorruptionLayer {}

impl AntiCorruptionLayer {
    pub(crate) fn translate_product_created_event(evt: ProductCreatedEvent) -> ProductAddedEvent {
        ProductAddedEvent::new(evt.product_id)
    }
}
