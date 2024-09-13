use serde::Deserialize;
use thiserror::Error;
use crate::core::{ProductCreatedEventV1, ProductDeletedEventV1, ProductUpdatedEventV1, PublicEventPublisher};

#[derive(Error, Debug)]
pub enum ApplicationError {
    #[error("InvalidTopic: {0}")]
    InvalidTopic(String),
    #[error("Error: {0}")]
    InternalError(String),
}

#[derive(Deserialize)]
pub struct ProductCreatedEvent {
    product_id: String,
}

#[derive(Deserialize)]
pub struct ProductUpdatedEvent {
    product_id: String,
}

#[derive(Deserialize)]
pub struct ProductDeletedEvent {
    product_id: String,
}

pub async fn translate_created_event<TPublicEventPublisher: PublicEventPublisher>(
    event_publisher: &TPublicEventPublisher,
    product_created_event: ProductCreatedEvent
) -> Result<(), ApplicationError> {
    let public_evt = ProductCreatedEventV1::new(product_created_event.product_id);
    
    event_publisher.publish_created(public_evt).await.map_err(|_| {
        ApplicationError::InternalError("Failure publishing event".to_string())
    })
}

pub async fn translate_updated_event<TPublicEventPublisher: PublicEventPublisher>(
    event_publisher: &TPublicEventPublisher,
    product_updated_event: ProductUpdatedEvent
) -> Result<(), ApplicationError> {
    let public_evt = ProductUpdatedEventV1::new(product_updated_event.product_id);

    event_publisher.publish_updated(public_evt).await.map_err(|_| {
        ApplicationError::InternalError("Failure publishing event".to_string())
    })
}

pub async fn translate_deleted_event<TPublicEventPublisher: PublicEventPublisher>(
    event_publisher: &TPublicEventPublisher,
    product_deleted_event: ProductDeletedEvent
) -> Result<(), ApplicationError> {
    let public_evt = ProductDeletedEventV1::new(product_deleted_event.product_id);

    event_publisher.publish_deleted(public_evt).await.map_err(|_| {
        ApplicationError::InternalError("Failure publishing event".to_string())
    })
}