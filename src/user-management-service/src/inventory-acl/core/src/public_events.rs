use serde::Deserialize;

#[derive(Deserialize)]
pub struct ProductCreatedEvent {
    pub(crate) product_id: String,
}
