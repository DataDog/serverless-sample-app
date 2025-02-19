use aws_config::BehaviorVersion;
use observability::TracedMessage;
use reqwest::redirect::Policy;
use serde_json::json;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::sleep;

struct ApiEndpoint(String);
struct EventBusName(String);

#[derive(Deserialize)]
pub struct UserDTO {
    #[serde(rename = "userId")]
    user_id: String,
    #[serde(rename = "firstName")]
    first_name: String,
    #[serde(rename = "lastName")]
    last_name: String,
    #[serde(rename = "emailAddress")]
    email_address: String,
    #[serde(rename = "orderCount")]
    order_count: usize,
}

#[derive(Deserialize)]
struct ApiResponse<T> {
    data: T,
}

#[derive(Deserialize)]
struct TokenData {
    token: String,
}

#[tokio::test]
async fn when_user_registers_then_should_be_able_to_login() {
    let environment = std::env::var("ENV").unwrap_or("dev".to_string());

    println!("Environment: {}", environment);
    let email_under_test = "test1@test.com";
    let password_under_test = "Test!23";

    let (api_endpoint, event_bus_name) = retrieve_paramater_values(&environment).await;
    println!("API endpoint is {}", &api_endpoint.0);
    println!("Event bus name is {}", &event_bus_name.0);

    let api_driver = ApiDriver::new(
        environment,
        api_endpoint.0.clone(),
        event_bus_name.0.clone(),
    )
    .await;

    let register_response = api_driver
        .register_user(email_under_test, "Test", "Doe", password_under_test)
        .await;

    assert_eq!(register_response.status(), 200);

    let login_response = api_driver
        .login_user(email_under_test, password_under_test)
        .await;

    assert_eq!(login_response.status(), 200);

    let login_data: ApiResponse<TokenData> = login_response
        .json()
        .await
        .expect("Get user details response body should serialize to UserDTO");

    api_driver
        .publish_order_completed_event(email_under_test)
        .await;

    sleep(Duration::from_secs(2)).await;

    let user_details_response = api_driver
        .get_user_details(email_under_test, &login_data.data.token)
        .await;

    assert_eq!(user_details_response.status(), 200);

    let user_response: ApiResponse<UserDTO> = user_details_response
        .json()
        .await
        .expect("Get user details response body should serialize to UserDTO");

    assert_eq!(user_response.data.order_count, 1);
    assert_eq!(user_response.data.first_name, "Test");
    assert_eq!(user_response.data.last_name, "Doe");
    assert_eq!(user_response.data.email_address, email_under_test);
    assert_eq!(user_response.data.user_id, email_under_test.to_uppercase());
}

async fn retrieve_paramater_values(environment: &str) -> (ApiEndpoint, EventBusName) {
    let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let ssm_client = aws_sdk_ssm::Client::new(&config);

    let api_endpoint = ssm_client
        .get_parameter()
        .name(format!(
            "/UserManagementService/{}/api-endpoint",
            environment
        ))
        .send()
        .await
        .expect("Failed to retrieve API endpoint")
        .parameter
        .expect("API endpoint not found")
        .value
        .expect("API Endpoint value not found");

    let event_bus_name = ssm_client
        .get_parameter()
        .name(format!("/{}/shared/event-bus-name", environment))
        .send()
        .await
        .expect("Failed to retrieve API endpoint")
        .parameter
        .expect("API endpoint not found")
        .value
        .expect("API Endpoint value not found");

    (ApiEndpoint(api_endpoint), EventBusName(event_bus_name))
}

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