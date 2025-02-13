use crate::{
    EventPublisher, InventoryItem, InventoryItemErrors, InventoryItems, StockLevelUpdatedEvent,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetStockLevelQuery {
    product_id: String,
}

impl GetStockLevelQuery {
    pub fn new(product_id: String) -> Self {
        Self { product_id }
    }

    pub async fn handle<T: InventoryItems>(
        &self,
        inventory_items: &T,
    ) -> Result<InventoryItem, InventoryItemErrors> {
        let inventory_item = inventory_items.with_product_id(&self.product_id).await?;

        Ok(inventory_item)
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetStockLevelCommand {
    product_id: String,
    stock_level: i32,
}

impl SetStockLevelCommand {
    pub async fn handle<TRepo: InventoryItems, TEvents: EventPublisher>(
        &self,
        inventory_items: &TRepo,
        event_publisher: &TEvents,
    ) -> Result<InventoryItem, InventoryItemErrors> {
        let mut inventory_item = inventory_items.with_product_id(&self.product_id).await?;

        let previous_stock_level = inventory_item.stock_level;

        inventory_item.update_stock_level(self.stock_level)?;

        inventory_items.store(&inventory_item).await?;
        let _ = event_publisher
            .publish(StockLevelUpdatedEvent {
                product_id: self.product_id.clone(),
                previous_stock_level: previous_stock_level,
                new_stock_level: self.stock_level,
            })
            .await;

        Ok(inventory_item)
    }
}
