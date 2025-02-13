use async_trait::async_trait;
use serde::Serialize;

use crate::public_events::InventoryStockUpdatedEventV1;

#[async_trait]
pub trait EventPublisher {
    async fn publish_stock_updated_event(
        &self,
        product_added_evt: StockUpdatedEvent,
    ) -> Result<(), ()>;
}

#[derive(Serialize)]
pub struct StockUpdatedEvent {
    product_id: String,
    stock_level: i32,
}

impl StockUpdatedEvent {
    pub(crate) fn new(product_id: String, stock_level: i32) -> Self {
        Self {
            product_id,
            stock_level,
        }
    }
}

pub(crate) struct AntiCorruptionLayer {}

impl AntiCorruptionLayer {
    pub(crate) fn translate_inventory_stock_updated_event(
        evt: InventoryStockUpdatedEventV1,
    ) -> StockUpdatedEvent {
        StockUpdatedEvent::new(evt.product_id, evt.new_stock_level)
    }
}
