use crate::core::{EventPublisher, ProductAddedEvent};
use async_trait::async_trait;
use tracing::instrument;
use observability::{parse_name_from_arn, TracedMessage};
use tracing_opentelemetry::OpenTelemetrySpanExt;

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
        name = "publish-product-added-event",
        skip(self, product_added_evt)
    )]
    async fn publish_product_added_event(
        &self,
        product_added_evt: ProductAddedEvent
,
    ) -> Result<(), ()> {
        tracing::Span::current().set_attribute("peer.service", parse_name_from_arn(&std::env::var("PRODUCT_ADDED_TOPIC_ARN").unwrap()));
        tracing::Span::current().set_attribute("peer.messaging.destination", std::env::var("PRODUCT_ADDED_TOPIC_ARN").unwrap());
        let _publish_res = &self
            .client
            .publish()
            .topic_arn(std::env::var("PRODUCT_ADDED_TOPIC_ARN").unwrap())
            .message(serde_json::to_string(&TracedMessage::new(&product_added_evt)).unwrap())
            .send()
            .await;

        Ok(())
    }
}
