use crate::core::{EventPublisher, ProductPricingChangedEvent};
use async_trait::async_trait;
use lambda_http::tracing::instrument;
use observability::TracedMessage;

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
        name = "publish-pricing-changed-event",
        skip(self, pricing_changed_event)
    )]
    async fn publish_product_pricing_changed_event(
        &self,
        pricing_changed_event: ProductPricingChangedEvent,
    ) -> Result<(), ()> {
        let _publish_res = &self
            .client
            .publish()
            .topic_arn(std::env::var("PRICE_CALCULATED_TOPIC_ARN").unwrap())
            .message(serde_json::to_string(&TracedMessage::new(&pricing_changed_event)).unwrap())
            .send()
            .await;

        Ok(())
    }
}
