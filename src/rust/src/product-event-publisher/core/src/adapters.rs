use crate::core::{
    ProductCreatedEventV1, ProductDeletedEventV1, ProductUpdatedEventV1, PublicEventPublisher,
};
use async_trait::async_trait;
use aws_sdk_eventbridge::Client;
use observability::TracedMessage;
use serde::Serialize;
use tracing::instrument;

pub struct EventBridgeEventPublisher {
    client: Client,
    event_bus_name: String,
    source: String,
}

impl EventBridgeEventPublisher {
    pub fn new(client: Client, event_bus_name: String, env: String) -> Self {
        Self {
            client,
            event_bus_name,
            source: format!("{}.products", env),
        }
    }

    #[instrument(name = "publish_event", skip(self, detail_type, detail), fields(peer.messaging.destination = self.event_bus_name, peer.service = self.event_bus_name))]
    async fn send_to_event_bridge<T>(&self, detail_type: String, detail: T) -> Result<(), ()>
    where
        T: Serialize,
    {
        let payload = TracedMessage::new(detail);
        let payload_string = serde_json::to_string(&payload).expect("Error serde");

        let request = aws_sdk_eventbridge::types::builders::PutEventsRequestEntryBuilder::default()
            .set_source(Some(self.source.clone()))
            .set_detail_type(Some(detail_type))
            .set_detail(Some(String::from(payload_string)))
            .set_event_bus_name(Some(self.event_bus_name.clone()))
            .build();
        self.client
            .put_events()
            .entries(request)
            .send()
            .await
            .map_err(|err| {
                tracing::error!("{}", err);
                ()
            })?;

        Ok(())
    }
}

#[async_trait]
impl PublicEventPublisher for EventBridgeEventPublisher {
    async fn publish_created(
        &self,
        product_created_event_v1: ProductCreatedEventV1,
    ) -> Result<(), ()> {
        let detail_type = "product.productCreated.v1".to_string();

        self.send_to_event_bridge(detail_type, product_created_event_v1)
            .await
    }

    async fn publish_updated(
        &self,
        product_updated_event_v1: ProductUpdatedEventV1,
    ) -> Result<(), ()> {
        let detail_type = "product.productUpdated.v1".to_string();

        self.send_to_event_bridge(detail_type, product_updated_event_v1)
            .await
    }

    async fn publish_deleted(
        &self,
        product_deleted_event_v1: ProductDeletedEventV1,
    ) -> Result<(), ()> {
        let detail_type = "product.productDeleted.v1".to_string();

        self.send_to_event_bridge(detail_type, product_deleted_event_v1)
            .await
    }
}
