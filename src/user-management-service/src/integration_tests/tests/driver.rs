use reqwest::redirect::Policy;
use serde_json::json;

pub(crate) struct ApiDriver {
    client: reqwest::Client,
    eb_client: aws_sdk_eventbridge::Client,
    base_url: String,
    event_bus_name: String,
}

impl ApiDriver {
    pub async fn new(base_url: String, event_bus_name: String) -> Self {
        let client = reqwest::Client::builder()
            .redirect(Policy::none())
            .build()
            .expect("Failed to create reqwest client");

        let config = aws_config::load_from_env().await;
        let event_bridge_client = aws_sdk_eventbridge::Client::new(&config);

        Self {
            client,
            base_url,
            event_bus_name,
            eb_client: event_bridge_client,
        }
    }

    pub async fn register_user(
        &self,
        email: &str,
        first_name: &str,
        last_name: &str,
        password: &str,
    ) -> reqwest::Response {
        let register_body = json!({
            "email_address": email,
            "first_name": first_name,
            "last_name": last_name,
            "password": password
        });

        self.client
            .post(&format!("{}/user", self.base_url))
            .header("Content-Type", "application/json")
            .body(register_body.to_string())
            .send()
            .await
            .expect("Register user request failed")
    }

    pub async fn login_user(&self, email: &str, password: &str) -> reqwest::Response {
        let login_body = json!({
            "email_address": email,
            "password": password
        });

        self.client
            .post(&format!("{}/user/login", self.base_url))
            .header("Content-Type", "application/json")
            .body(login_body.to_string())
            .send()
            .await
            .expect("Login user request failed")
    }

    pub async fn publish_order_completed_event(&self, email: &str) {
        let payload_string = json!({
            "data": {
                "email_address": email
            }
        });

        let request = aws_sdk_eventbridge::types::builders::PutEventsRequestEntryBuilder::default()
            .set_source(Some("dev.orders".to_string()))
            .set_detail_type(Some("orders.orderCompleted.v1".to_string()))
            .set_detail(Some(payload_string.to_string()))
            .set_event_bus_name(Some(self.event_bus_name.clone()))
            .build();
        let _ = self.eb_client
            .put_events()
            .entries(request)
            .send()
            .await
            .expect("Test event should publish");
    }
}
