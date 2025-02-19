use observability::TracedMessage;
use reqwest::redirect::Policy;
use serde::Serialize;
use serde_json::json;

pub(crate) struct ApiDriver {
    env: String,
    client: reqwest::Client,
    eb_client: aws_sdk_eventbridge::Client,
    base_url: String,
    event_bus_name: String,
}

#[derive(Serialize)]
pub struct UserCreatedEvent {
    email_address: String,
}

impl ApiDriver {
    pub async fn new(env: String, base_url: String, event_bus_name: String) -> Self {
        let client = reqwest::Client::builder()
            .redirect(Policy::none())
            .build()
            .expect("Failed to create reqwest client");

        let config = aws_config::load_from_env().await;
        let event_bridge_client = aws_sdk_eventbridge::Client::new(&config);

        Self {
            env,
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
            .post(&format!("{}/login", self.base_url))
            .header("Content-Type", "application/json")
            .body(login_body.to_string())
            .send()
            .await
            .expect("Login user request failed")
    }

    pub async fn get_user_details(&self, email: &str, bearer_token: &str) -> reqwest::Response {
        self.client
            .get(&format!("{}/user/{}", self.base_url, email))
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", bearer_token))
            .send()
            .await
            .expect("Get user details request failed")
    }

    pub async fn publish_order_completed_event(&self, email: &str) {
        let payload = TracedMessage::new(UserCreatedEvent {
            email_address: email.to_string(),
        });
        let payload_string = serde_json::to_string(&payload).expect("Error serde");

        let request = aws_sdk_eventbridge::types::builders::PutEventsRequestEntryBuilder::default()
            .set_source(Some(format!("{}.orders", &self.env)))
            .set_detail_type(Some("orders.orderCompleted.v1".to_string()))
            .set_detail(Some(String::from(payload_string)))
            .set_event_bus_name(Some(self.event_bus_name.clone()))
            .build();
        let _ = self
            .eb_client
            .put_events()
            .entries(request)
            .send()
            .await
            .expect("Test event should publish");
    }
}
