use crate::{
    EventPublisher, InventoryItem, InventoryItemErrors, InventoryItems, StockLevelUpdatedEvent,
};
use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::types::ComparisonOperator::In;
use aws_sdk_dynamodb::Client;
use observability::{parse_name_from_arn, TracedMessage};
use serde::Serialize;
use tracing::{instrument, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;

pub struct DynamoDbRepository {
    client: Client,
    table_name: String,
}

impl DynamoDbRepository {
    pub fn new(client: Client, table_name: String) -> DynamoDbRepository {
        DynamoDbRepository { client, table_name }
    }

    async fn put_to_dynamo(&self, product: &InventoryItem) -> Result<(), InventoryItemErrors> {
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.PutItem {}", &self.table_name),
        );
        let res = self
            .client
            .put_item()
            .table_name(&self.table_name)
            .item("PK", AttributeValue::S(product.product_id.clone()))
            .item("productId", AttributeValue::S(product.product_id.clone()))
            .item(
                "stockLevel",
                AttributeValue::N(product.stock_level.clone().to_string()),
            )
            .item("Type", AttributeValue::S("InventoryItem".to_string()))
            .send()
            .await;

        match res {
            Ok(_) => Ok(()),
            Err(e) => {
                tracing::error!("{}", e.to_string());

                Err(InventoryItemErrors::InternalError(e.to_string()))
            }
        }
    }
}

#[async_trait]
impl InventoryItems for DynamoDbRepository {
    #[instrument(name = "with_product_id", skip(self, product_id), fields(peer.aws.dynamodb.table_name = self.table_name, peer.db.name = self.table_name, tablename = self.table_name, product.id = product_id))]
    async fn with_product_id(
        &self,
        product_id: &str,
    ) -> Result<InventoryItem, InventoryItemErrors> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.GetItem {}", &self.table_name),
        );
        tracing::info!("Retrieving record from DynamoDB: {product_id}");

        let res = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(product_id.to_string()))
            .send()
            .await;

        match res {
            Ok(item) => Ok({
                if item.item.is_none() {
                    return Err(InventoryItemErrors::NotFound(product_id.to_string()));
                }

                let attributes = item.item().unwrap().clone();

                let inventory_item = InventoryItem {
                    product_id: attributes.get("productId").unwrap().as_s().unwrap().clone(),
                    stock_level: attributes
                        .get("stockLevel")
                        .unwrap()
                        .as_n()
                        .unwrap()
                        .clone()
                        .parse::<i32>()
                        .unwrap(),
                };

                inventory_item
            }),
            Err(_e) => Err(InventoryItemErrors::NotFound(product_id.to_string())),
        }
    }

    #[instrument(name = "store", skip(self, item), fields(peer.aws.dynamodb.table_name = self.table_name, peer.db.name = self.table_name, tablename = self.table_name, product.id = item.product_id))]
    async fn store(&self, item: &InventoryItem) -> Result<(), InventoryItemErrors> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        self.put_to_dynamo(item).await
    }
}

pub struct EventBridgeEventPublisher {
    client: aws_sdk_eventbridge::Client,
    event_bus_name: String,
    source: String,
}

impl EventBridgeEventPublisher {
    pub fn new(client: aws_sdk_eventbridge::Client, event_bus_name: String, env: &str) -> Self {
        Self {
            client,
            event_bus_name,
            source: format!("{}.inventory", env),
        }
    }

    #[instrument(name = "publish_event", skip(self, detail_type, detail), fields(peer.messaging.destination = self.event_bus_name, peer.service = self.event_bus_name))]
    async fn send_to_event_bridge<T>(&self, detail_type: String, detail: T) -> Result<(), ()>
    where
        T: Serialize,
    {
        if &self.event_bus_name == "no_op" {
            return Ok(());
        }

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
impl EventPublisher for EventBridgeEventPublisher {
    #[instrument(name = "publish", skip(self, stock_level_updated_evt))]
    async fn publish(
        &self,
        stock_level_updated_evt: StockLevelUpdatedEvent,
    ) -> Result<(), InventoryItemErrors> {
        let detail_type = "inventory.stockUpdated.v1".to_string();

        self.send_to_event_bridge(detail_type, stock_level_updated_evt)
            .await
            .map_err(|e| {
                InventoryItemErrors::InternalError("Error publishing event".to_string())
            })?;

        Ok(())
    }
}

pub struct NoOpEventPublisher {}

#[async_trait]
impl EventPublisher for NoOpEventPublisher {
    async fn publish(
        &self,
        stock_level_updated_evt: StockLevelUpdatedEvent,
    ) -> Result<(), InventoryItemErrors> {
        Ok(())
    }
}
