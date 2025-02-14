use serde::Deserialize;

#[derive(Deserialize)]
pub struct InventoryStockUpdatedEventV1 {
    pub(crate) product_id: String,
    pub(crate) new_stock_level: i32,
}
