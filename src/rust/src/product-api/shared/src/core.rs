use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum RepositoryError {
    #[error("Product not found")]
    NotFound,
    #[error("Error: {0}")]
    InternalError(String),
}

#[async_trait]
pub trait EventPublisher {
    async fn publish_product_created_event(&self, product_created_event: ProductCreatedEvent) -> Result<(), ()>;
    async fn publish_product_updated_event(&self, product_updated_event: ProductUpdatedEvent) -> Result<(), ()>;
    async fn publish_product_deleted_event(&self, product_deleted_event: ProductDeletedEvent) -> Result<(), ()>;
}

#[async_trait]
pub trait Repository {
    async fn store_product(&self, body: &Product) -> Result<(), RepositoryError>;

    async fn get_product(&self, id: &String) -> Result<Product, RepositoryError>;

    async fn update_product(&self, body: &Product) -> Result<(), RepositoryError>;

    async fn delete_product(&self, id: &String) -> Result<(), RepositoryError>;
}

#[derive(Serialize)]
pub struct ProductDTO {
    product_id: String,
    name: String,
    price: f32,
    price_brackets: Vec<ProductPriceBracket>,
}

#[derive(Clone, Serialize)]
pub(crate) struct Product {
    pub(crate) product_id: String,
    pub(crate) previous_name: String,
    pub(crate) name: String,
    pub(crate) price: f32,
    pub(crate) previous_price: f32,
    pub(crate) updated: bool,
    pub(crate) price_brackets: Vec<ProductPriceBracket>,
}

impl Product {
    pub(crate) fn new(name: String, price: f32) -> Self {
        Self {
            name,
            price,
            product_id: Uuid::new_v4().to_string(),
            previous_name: "".to_string(),
            previous_price: -1.0,
            updated: false,
            price_brackets: vec![],
        }
    }

    pub(crate) fn update(mut self, name: String, price: f32) -> Self {
        if self.name != name {
            self.previous_name = self.name;
            self.name = name;
            self.updated = true;
        }

        if self.price != price {
            self.previous_price = self.price;
            self.price = price;
            self.updated = true;
        }

        self
    }

    pub(crate) fn clear_pricing(mut self) {
        self.price_brackets = vec![];
    }

    pub(crate) fn add_price(mut self, price_bracket: ProductPriceBracket) {
        self.price_brackets.push(price_bracket);
    }

    pub(crate) fn as_dto(&self) -> ProductDTO {
        ProductDTO {
            price: self.price.clone(),
            product_id: self.product_id.clone(),
            name: self.name.clone(),
            price_brackets: self.price_brackets.to_vec(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct ProductPriceBracket {
    quantity: i32,
    price: f32,
}

impl ProductPriceBracket {
    fn new(quantity: i32, price: f32) -> Self {
        Self { quantity, price }
    }
}

#[derive(Serialize)]
pub struct ProductCreatedEvent {
    product_id: String,
    name: String,
    price: f32
}

impl Into<ProductCreatedEvent> for Product {
    fn into(self) -> ProductCreatedEvent {
        ProductCreatedEvent{
            price: self.price.clone(),
            product_id: self.product_id.clone(),
            name: self.name.clone()
        }
    }
}

impl Into<ProductUpdatedEvent> for Product {
    fn into(self) -> ProductUpdatedEvent {
        ProductUpdatedEvent{
            product_id: self.product_id.clone(),
            previous: ProductDTO{
                name: self.previous_name.clone(),
                price: self.previous_price.clone(),
                product_id: self.product_id.clone(),
                price_brackets: vec![]
            },
            new: ProductDTO{
                name: self.name.clone(),
                price: self.price.clone(),
                product_id: self.product_id.clone(),
                price_brackets: vec![]
            }
        }
    }
}

impl Into<ProductDeletedEvent> for Product {
    fn into(self) -> ProductDeletedEvent {
        ProductDeletedEvent{
            product_id: self.product_id.clone(),
        }
    }
}
#[derive(Serialize)]
pub struct ProductUpdatedEvent {
    product_id: String,
    previous: ProductDTO,
    new: ProductDTO
}
#[derive(Serialize)]
pub struct ProductDeletedEvent {
    product_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn can_create_product_should_set_values() {
        let product = Product::new("Test name".to_string(), 12.99);

        assert_ne!(product.product_id, "");
        assert_eq!(product.name, "Test name");
        assert_eq!(product.price, 12.99);
    }

    #[test]
    fn can_update_product_should_update_values() {
        let mut product = Product::new("Test name".to_string(), 12.99);
        product = product.update("New name".to_string(), 15.0);

        assert_ne!(product.product_id, "");
        assert_eq!(product.name, "New name");
        assert_eq!(product.price, 15.0);
        assert_eq!(product.previous_name, "Test name");
        assert_eq!(product.previous_price, 12.99);
        assert_eq!(product.updated, true);
    }

    #[test]
    fn can_update_product_with_no_changes_should_not_update_values() {
        let mut product = Product::new("Test name".to_string(), 12.99);
        product = product.update("Test name".to_string(), 12.99);

        assert_ne!(product.product_id, "");
        assert_eq!(product.name, "Test name");
        assert_eq!(product.price, 12.99);
        assert_eq!(product.previous_name, "");
        assert_eq!(product.previous_price, -1.0);
        assert_eq!(product.updated, false);
    }
}
