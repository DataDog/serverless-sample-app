use async_trait::async_trait;
use serde::Serialize;
use std::time;

#[async_trait]
pub trait EventPublisher {
    async fn publish_product_pricing_changed_event(
        &self,
        evt: ProductPricingChangedEvent,
    ) -> Result<(), ()>;
}

#[derive(Serialize)]
pub struct ProductPricingChangedEvent {
    product_id: String,
    price_brackets: Vec<PricingResult>,
}

impl ProductPricingChangedEvent {
    pub(crate) fn new(product_id: String, price_brackets: Vec<PricingResult>) -> Self {
        Self {
            product_id,
            price_brackets,
        }
    }
}

pub(crate) struct PricingService {}

#[derive(Serialize)]
pub(crate) struct PricingResult {
    quantity_to_order: i32,
    price: f32,
}

impl PricingService {
    pub(crate) fn calculate_pricing_for(price: f32) -> Vec<PricingResult> {
        if price > 50.0 && price < 60.0 {
            std::thread::sleep(time::Duration::from_secs(40));
        }

        if price > 90.0 && price < 95.0 {
            panic!("Failure in pricing service");
        }

        let results = vec![
            PricingResult {
                quantity_to_order: 5,
                price: price * 0.95,
            },
            PricingResult {
                quantity_to_order: 10,
                price: price * 0.9,
            },
            PricingResult {
                quantity_to_order: 25,
                price: price * 0.8,
            },
            PricingResult {
                quantity_to_order: 50,
                price: price * 0.75,
            },
            PricingResult {
                quantity_to_order: 100,
                price: price * 0.7,
            },
        ];

        results
    }
}
