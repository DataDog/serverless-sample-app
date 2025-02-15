use aws_config::BehaviorVersion;
use driver::ApiDriver;

mod driver;

struct ApiEndpoint(String);
struct EventBusName(String);

#[tokio::test]
async fn when_user_registers_then_should_be_able_to_login() {
    let (api_endpoint, event_bus_name) = retrieve_paramater_values().await;
    let api_driver = ApiDriver::new(api_endpoint.0.clone(), event_bus_name.0.clone()).await;

    let register_response = api_driver
        .register_user("test@test.com", "Test", "Doe", "Test!23")
        .await;

    assert_eq!(register_response.status(), 200);

    let login_response = api_driver.login_user("test@test.com", "Test!23").await;

    assert_eq!(login_response.status(), 200);

    api_driver.publish_order_completed_event("test@test.com").await;
}

async fn retrieve_paramater_values() -> (ApiEndpoint, EventBusName) {
    let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let ssm_client = aws_sdk_ssm::Client::new(&config);
    let environment = std::env::var("ENV").unwrap_or("dev".to_string());

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
        .name(format!(
            "/{}/shared/event-bus-name",
            environment
        ))
        .send()
        .await
        .expect("Failed to retrieve API endpoint")
        .parameter
        .expect("API endpoint not found")
        .value
        .expect("API Endpoint value not found");

    (ApiEndpoint(api_endpoint), EventBusName(event_bus_name))
}
