use aws_config::BehaviorVersion;
use driver::ApiDriver;
use serde::{Deserialize, Serialize};
use std::result;
use std::time::Duration;
use tokio::time::sleep;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{layer::SubscriberExt, Registry};

mod driver;

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

    println!("{}", user_response.data.email_address);
    println!("{}", user_response.data.order_count);

    assert_eq!(user_response.data.order_count, 1);
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
