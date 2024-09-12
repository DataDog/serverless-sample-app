use crate::core::{
    EventPublisher, Product, ProductCreatedEvent, ProductDeletedEvent, ProductUpdatedEvent,
    Repository, RepositoryError,
};
use async_trait::async_trait;
use aws_sdk_dynamodb::error::ProvideErrorMetadata;
use aws_sdk_dynamodb::operation::put_item::PutItemOutput;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client;
use aws_sdk_sns::error::SdkError;
use lambda_http::tracing::instrument;
use observability::TracedMessage;
use opentelemetry::trace::TraceContextExt;
use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::Span;
use tracing_opentelemetry::OpenTelemetrySpanExt;

pub struct DynamoDbRepository {
    client: Client,
    table_name: String,
}

impl DynamoDbRepository {
    pub fn new(client: Client, table_name: String) -> DynamoDbRepository {
        DynamoDbRepository { client, table_name }
    }

    async fn put_to_dynamo(&self, product: &Product) -> Result<(), RepositoryError> {
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.PutItem {}", &self.table_name),
        );
        let res = self
            .client
            .put_item()
            .table_name(&self.table_name)
            .item("PK", AttributeValue::S(product.product_id.clone()))
            .item("Name", AttributeValue::S(product.name.clone()))
            .item(
                "Price",
                AttributeValue::N(product.price.clone().to_string()),
            )
            .item("ProductId", AttributeValue::S(product.product_id.clone()))
            .item(
                "PriceBrackets",
                AttributeValue::S(serde_json::to_string(&product.price_brackets).unwrap()),
            )
            .send()
            .await;

        match res {
            Ok(_) => Ok(()),
            Err(e) => {
                tracing::error!("{}", e.to_string());

                Err(RepositoryError::InternalError(e.to_string()))
            }
        }
    }
}

#[async_trait]
impl Repository for DynamoDbRepository {
    #[instrument(name = "store-product", skip(self, body), fields(aws.dynamodb.table_name = self.table_name, tablename = self.table_name, product.id = body.product_id))]
    async fn store_product(&self, body: &Product) -> Result<(), RepositoryError> {
        tracing::Span::current().set_attribute("span.type", "dynamodb");
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.GetItem {}", &self.table_name),
        );
        self.put_to_dynamo(body).await
    }

    #[instrument(name = "get-product", skip(self, id), fields(aws.dynamodb.table_name = self.table_name, tablename = self.table_name, product.id = id))]
    async fn get_product(&self, id: &String) -> Result<crate::core::Product, RepositoryError> {
        Span::current().set_attribute("span.type", "dynamodb");
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.GetItem {}", &self.table_name),
        );
        tracing::info!("Retrieving record from DynamoDB: {id}");

        let res = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(id.to_string()))
            .send()
            .await;

        match res {
            Ok(item) => Ok({
                if item.item.is_none() {
                    return Err(RepositoryError::NotFound);
                }

                let attributes = item.item().unwrap().clone();

                let product = Product {
                    product_id: attributes.get("ProductId").unwrap().as_s().unwrap().clone(),
                    name: attributes.get("Name").unwrap().as_s().unwrap().clone(),
                    price: attributes
                        .get("Price")
                        .unwrap()
                        .as_n()
                        .unwrap()
                        .clone()
                        .parse::<f32>()
                        .unwrap(),
                    previous_price: -1.0,
                    previous_name: "".to_string(),
                    updated: false,
                    price_brackets: serde_json::from_str(
                        &attributes
                            .get("PriceBrackets")
                            .unwrap()
                            .as_s()
                            .unwrap()
                            .clone(),
                    )
                    .unwrap(),
                };

                product
            }),
            Err(e) => Err(RepositoryError::NotFound),
        }
    }

    #[instrument(name = "update-product", skip(self, body), fields(aws.dynamodb.table_name = self.table_name, tablename = self.table_name, product.id = body.product_id))]
    async fn update_product(&self, body: &Product) -> Result<(), RepositoryError> {
        tracing::Span::current().set_attribute("span.type", "dynamodb");
        self.put_to_dynamo(body).await
    }

    #[instrument(name = "delete-product", skip(self, id), fields(aws.dynamodb.table_name = self.table_name, tablename = self.table_name, product.id = id))]
    async fn delete_product(&self, id: &String) -> Result<(), RepositoryError> {
        Span::current().set_attribute("span.type", "dynamodb");
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.DeleteItem {}", &self.table_name),
        );

        let res = self
            .client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(id.to_string()))
            .send()
            .await;

        Ok(())
    }
}

pub struct SnsEventPublisher {
    client: aws_sdk_sns::Client,
}

impl SnsEventPublisher {
    pub fn new(client: aws_sdk_sns::Client) -> SnsEventPublisher {
        SnsEventPublisher { client }
    }
}

#[async_trait]
impl EventPublisher for SnsEventPublisher {
    #[instrument(
        name = "publish-product-created-event",
        skip(self, product_created_event)
    )]
    async fn publish_product_created_event(
        &self,
        product_created_event: ProductCreatedEvent,
    ) -> Result<(), ()> {
        let _publish_res = &self
            .client
            .publish()
            .topic_arn(std::env::var("PRODUCT_CREATED_TOPIC_ARN").unwrap())
            .message(serde_json::to_string(&TracedMessage::new(product_created_event)).unwrap())
            .send()
            .await;

        Ok(())
    }

    #[instrument(
        name = "publish-product-updated-event",
        skip(self, product_updated_event)
    )]
    async fn publish_product_updated_event(
        &self,
        product_updated_event: ProductUpdatedEvent,
    ) -> Result<(), ()> {
        let _publish_res = &self
            .client
            .publish()
            .topic_arn(std::env::var("PRODUCT_UPDATED_TOPIC_ARN").unwrap())
            .message(serde_json::to_string(&TracedMessage::new(product_updated_event)).unwrap())
            .send()
            .await;

        Ok(())
    }

    #[instrument(
        name = "publish-product-deleted-event",
        skip(self, product_deleted_event)
    )]
    async fn publish_product_deleted_event(
        &self,
        product_deleted_event: ProductDeletedEvent,
    ) -> Result<(), ()> {
        let _publish_res = &self
            .client
            .publish()
            .topic_arn(std::env::var("PRODUCT_DELETED_TOPIC_ARN").unwrap())
            .message(serde_json::to_string(&TracedMessage::new(product_deleted_event)).unwrap())
            .send()
            .await;

        Ok(())
    }
}
