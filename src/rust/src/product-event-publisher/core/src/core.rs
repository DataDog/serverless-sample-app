use async_trait::async_trait;
use serde::Serialize;

#[async_trait]
pub trait PublicEventPublisher {
    async fn publish_created(
        &self,
        product_created_event_v1: ProductCreatedEventV1,
    ) -> Result<(), ()>;
    async fn publish_updated(
        &self,
        product_updated_event_v1: ProductUpdatedEventV1,
    ) -> Result<(), ()>;
    async fn publish_deleted(
        &self,
        product_deleted_event_v1: ProductDeletedEventV1,
    ) -> Result<(), ()>;
}

#[derive(Serialize)]
pub struct ProductCreatedEventV1 {
    product_id: String,
}

impl ProductCreatedEventV1 {
    pub(crate) fn new(product_id: String) -> Self {
        Self { product_id }
    }
}

#[derive(Serialize)]
pub struct ProductUpdatedEventV1 {
    product_id: String,
}

impl ProductUpdatedEventV1 {
    pub(crate) fn new(product_id: String) -> Self {
        Self { product_id }
    }
}

#[derive(Serialize)]
pub struct ProductDeletedEventV1 {
    product_id: String,
}

impl ProductDeletedEventV1 {
    pub(crate) fn new(product_id: String) -> Self {
        Self { product_id }
    }
}
