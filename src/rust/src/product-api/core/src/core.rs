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
    async fn publish_product_created_event(
        &self,
        product_created_event: ProductCreatedEvent,
    ) -> Result<(), ()>;
    async fn publish_product_updated_event(
        &self,
        product_updated_event: ProductUpdatedEvent,
    ) -> Result<(), ()>;
    async fn publish_product_deleted_event(
        &self,
        product_deleted_event: ProductDeletedEvent,
    ) -> Result<(), ()>;
}

#[async_trait]
pub trait Repository {
    async fn list_products(&self) -> Result<Vec<Product>, RepositoryError>;

    async fn store_product(&self, body: &Product) -> Result<(), RepositoryError>;

    async fn get_product(&self, id: &str) -> Result<Product, RepositoryError>;

    async fn update_product(&self, body: &Product) -> Result<(), RepositoryError>;

    async fn delete_product(&self, id: &str) -> Result<(), RepositoryError>;
}

#[derive(Serialize)]
pub struct ProductDTO {
    #[serde(rename = "productId")]
    product_id: String,
    name: String,
    price: f32,
    #[serde(rename = "pricingBrackets")]
    price_brackets: Vec<ProductPriceBracket>,
    stock_level: i32,
}

#[derive(Clone, Serialize)]
pub struct Product {
    pub(crate) product_id: String,
    pub(crate) previous_name: String,
    pub(crate) name: String,
    pub(crate) stock_level: i32,
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
            stock_level: 0,
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

    pub(crate) fn update_stock_level(&mut self, stock_level: i32) {
        self.stock_level = stock_level;
    }

    pub(crate) fn clear_pricing(mut self) -> Self {
        self.price_brackets = vec![];

        self
    }

    pub(crate) fn add_price(mut self, price_bracket: ProductPriceBracket) -> Self {
        self.price_brackets.push(price_bracket);

        self
    }

    pub(crate) fn as_dto(&self) -> ProductDTO {
        ProductDTO {
            price: self.price,
            product_id: self.product_id.clone(),
            name: self.name.clone(),
            price_brackets: self.price_brackets.to_vec(),
            stock_level: self.stock_level,
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct ProductPriceBracket {
    quantity: i32,
    price: f32,
}

impl ProductPriceBracket {
    pub fn new(quantity: i32, price: f32) -> Self {
        Self { quantity, price }
    }
}

#[derive(Serialize)]
pub struct ProductCreatedEvent {
    product_id: String,
    name: String,
    price: f32,
}

impl From<Product> for ProductCreatedEvent {
    fn from(value: Product) -> Self {
        ProductCreatedEvent {
            price: value.price,
            product_id: value.product_id,
            name: value.name,
        }
    }
}

impl From<Product> for ProductUpdatedEvent {
    fn from(value: Product) -> Self {
        ProductUpdatedEvent {
            product_id: value.product_id.clone(),
            previous: ProductDTO {
                name: value.previous_name,
                price: value.previous_price,
                product_id: value.product_id.clone(),
                price_brackets: vec![],
                stock_level: value.stock_level,
            },
            new: ProductDTO {
                name: value.name,
                price: value.price,
                product_id: value.product_id.clone(),
                price_brackets: vec![],
                stock_level: value.stock_level,
            },
        }
    }
}

impl From<Product> for ProductDeletedEvent {
    fn from(value: Product) -> Self {
        ProductDeletedEvent {
            product_id: value.product_id.clone(),
        }
    }
}

#[derive(Serialize)]
pub struct ProductUpdatedEvent {
    product_id: String,
    previous: ProductDTO,
    new: ProductDTO,
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
