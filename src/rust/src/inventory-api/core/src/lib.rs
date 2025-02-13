use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

mod adapters;
mod ports;

pub use adapters::{DynamoDbRepository, EventBridgeEventPublisher, NoOpEventPublisher};
pub use ports::{GetStockLevelQuery, SetStockLevelCommand};

#[derive(Error, Debug)]
pub enum InventoryItemErrors {
    #[error("Product '{0}' not found")]
    NotFound(String),
    #[error("Invalid Stock Level for Product '{0}: {1}")]
    InvalidStock(String, i32),
    #[error("Error: {0}")]
    InternalError(String),
}

#[derive(Serialize, Deserialize)]
pub struct InventoryItem {
    product_id: String,
    stock_level: i32,
}

impl InventoryItem {
    fn update_stock_level(&mut self, new_stock_level: i32) -> Result<(), InventoryItemErrors> {
        if new_stock_level < 0 {
            return Err(InventoryItemErrors::InvalidStock(
                self.product_id.clone(),
                new_stock_level,
            ));
        }

        self.stock_level = new_stock_level;

        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
struct StockLevelUpdatedEvent {
    product_id: String,
    previous_stock_level: i32,
    new_stock_level: i32,
}

#[async_trait]
pub trait InventoryItems {
    async fn with_product_id(&self, product_id: &str)
        -> Result<InventoryItem, InventoryItemErrors>;
    async fn store(&self, item: &InventoryItem) -> Result<(), InventoryItemErrors>;
}

#[async_trait]
pub trait EventPublisher {
    async fn publish(&self, event: StockLevelUpdatedEvent) -> Result<(), InventoryItemErrors>;
}
