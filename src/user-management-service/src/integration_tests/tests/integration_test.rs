use aws_config::BehaviorVersion;
use observability::CloudEvent;
use reqwest::redirect::Policy;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use tokio::time::sleep;
use sha2::{Digest, Sha256};
use base64::Engine;
use std::collections::HashMap;

struct ApiEndpoint(String);
struct EventBusName(String);

#[derive(Deserialize)]
pub struct UserDTO {
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
    let random_email = uuid::Uuid::new_v4().to_string();

    println!("Environment: {}", environment);
    let email_under_test = format!("{}@test.com", random_email);
    let password_under_test = "Test!23";

    let (api_endpoint, event_bus_name) = retrieve_parameter_values(&environment).await;
    println!("API endpoint is {}", &api_endpoint.0);
    println!("Event bus name is {}", &event_bus_name.0);

    let api_driver = ApiDriver::new(
        environment,
        api_endpoint.0.clone(),
        event_bus_name.0.clone(),
    )
    .await;


    println!("Email under test is {}", &email_under_test);

    let register_response = api_driver
        .register_user(&email_under_test, "Test", "Doe", password_under_test)
        .await;

    assert_eq!(register_response.status(), 200);

    let _: ApiResponse<UserDTO> = register_response
        .json()
        .await
        .expect("Get user details response body should serialize to UserDTO");

    let login_response = api_driver
        .login_user(&email_under_test, password_under_test)
        .await;

    assert_eq!(login_response.status(), 200);
}

#[tokio::test]
async fn when_order_completed_event_is_published_order_count_is_increased() {
    let environment = std::env::var("ENV").unwrap_or("dev".to_string());
    let random_email = uuid::Uuid::new_v4().to_string();

    println!("Environment: {}", environment);
    let email_under_test = format!("{}@test.com", random_email);
    let password_under_test = "Test!23";

    let (api_endpoint, event_bus_name) = retrieve_parameter_values(&environment).await;
    println!("API endpoint is {}", &api_endpoint.0);
    println!("Event bus name is {}", &event_bus_name.0);

    let api_driver = ApiDriver::new(
        environment,
        api_endpoint.0.clone(),
        event_bus_name.0.clone(),
    )
    .await;

    let register_response = api_driver
        .register_user(&email_under_test, "Test", "Doe", password_under_test)
        .await;
    assert_eq!(register_response.status(), 200);

    let user_response: ApiResponse<UserDTO> = register_response
        .json()
        .await
        .expect("Get user details response body should serialize to UserDTO");

    let login_response = api_driver
        .login_user(&email_under_test, password_under_test)
        .await;

    let login_data: ApiResponse<TokenData> = login_response
        .json()
        .await
        .expect("Get user details response body should serialize to UserDTO");

    api_driver
        .publish_order_completed_event(&email_under_test)
        .await;

    sleep(Duration::from_secs(2)).await;

    let user_details_response = api_driver
        .get_user_details(&user_response.data.email_address, &login_data.data.token)
        .await;

    assert_eq!(user_details_response.status(), 200);

    let user_response: ApiResponse<UserDTO> = user_details_response
        .json()
        .await
        .expect("Get user details response body should serialize to UserDTO");

    assert_eq!(user_response.data.order_count, 1);
}

#[tokio::test]
async fn oauth_authorization_code_flow_should_work_end_to_end() {
    let environment = std::env::var("ENV").unwrap_or("dev".to_string());
    let random_email = uuid::Uuid::new_v4().to_string();
    
    println!("Environment: {}", environment);
    let email_under_test = format!("{}@test.com", random_email);
    let password_under_test = "Test!23";
    
    let (api_endpoint, event_bus_name) = retrieve_parameter_values(&environment).await;
    println!("API endpoint is {}", &api_endpoint.0);
    println!("Event bus name is {}", &event_bus_name.0);
    
    let api_driver = ApiDriver::new(
        environment,
        api_endpoint.0.clone(),
        event_bus_name.0.clone(),
    ).await;
    
    // Step 1: Register a test user
    let register_response = api_driver
        .register_user(&email_under_test, "Test", "User", password_under_test)
        .await;
    assert_eq!(register_response.status(), 200);
    
    // Step 2: Create an OAuth client
    let (client_name, grant_types, redirect_uris, response_types) = OAuthClientBuilder::new()
        .with_client_name("test_oauth_client")
        .with_grant_types(vec!["authorization_code".to_string()])
        .with_redirect_uris(vec!["http://localhost:3000/callback".to_string()])
        .with_response_types(vec!["code".to_string()])
        .build();
    
    let client_response = api_driver
        .create_oauth_client(&client_name, grant_types.iter().map(|s| s.as_str()).collect(), redirect_uris.iter().map(|s| s.as_str()).collect(), response_types.iter().map(|s| s.as_str()).collect())
        .await;
    assert_eq!(client_response.status(), 201);
    
    let oauth_client: OAuthClientResponse = client_response
        .json()
        .await
        .expect("OAuth client response should serialize to OAuthClientResponse");
    
    // Step 3: Initiate authorization request (GET /oauth/authorize)
    let auth_request = AuthorizeRequestBuilder::new()
        .with_client_id(oauth_client.client_id.clone())
        .with_redirect_uri("http://localhost:3000/callback")
        .with_scope("read write")
        .with_state("test_state_123")
        .with_response_type("code")
        .build();
    
    let auth_response = api_driver
        .oauth_authorize_get(
            &auth_request.response_type,
            &auth_request.client_id,
            &auth_request.redirect_uri,
            auth_request.scope.as_deref(),
            auth_request.state.as_deref(),
            auth_request.code_challenge.as_deref(),
            auth_request.code_challenge_method.as_deref(),
        )
        .await;
    
    assert_eq!(auth_response.status(), 200);
    
    // Step 4: Extract CSRF token from HTML response
    let html_content = auth_response.text().await.unwrap();
    let csrf_token = api_driver
        .extract_csrf_token_from_html(&html_content)
        .expect("Should extract CSRF token from HTML");
    
    // Step 5: Submit login form
    let login_form_response = api_driver
        .oauth_authorize_form_post(
            &email_under_test,
            password_under_test,
            &auth_request.client_id,
            &auth_request.redirect_uri,
            auth_request.scope.as_deref(),
            auth_request.state.as_deref(),
            auth_request.code_challenge.as_deref(),
            auth_request.code_challenge_method.as_deref(),
            &csrf_token,
        )
        .await;
    
    // Should redirect with 302 Found
    assert_eq!(login_form_response.status(), 302);
    
    // Step 6: Extract authorization code from redirect URL
    let redirect_url = login_form_response
        .headers()
        .get("location")
        .expect("Should have location header")
        .to_str()
        .expect("Location header should be valid string");
    
    let authorization_code = api_driver
        .extract_authorization_code_from_redirect(redirect_url)
        .expect("Should extract authorization code from redirect");
    
    // Step 7: Exchange authorization code for access token
    let token_request = TokenRequestBuilder::new()
        .with_grant_type("authorization_code")
        .with_client_id(oauth_client.client_id.clone())
        .with_client_secret(oauth_client.client_secret.clone())
        .with_code(authorization_code)
        .with_redirect_uri("http://localhost:3000/callback")
        .build();
    
    let token_response = api_driver
        .oauth_token_exchange(
            &token_request.grant_type,
            &token_request.client_id,
            token_request.client_secret.as_deref(),
            token_request.code.as_deref(),
            token_request.redirect_uri.as_deref(),
            token_request.code_verifier.as_deref(),
            token_request.refresh_token.as_deref(),
            token_request.scope.as_deref(),
        )
        .await;
    
    assert_eq!(token_response.status(), 200);
    
    let token_data: TokenResponse = token_response
        .json()
        .await
        .expect("Token response should serialize to TokenResponse");
    
    // Step 8: Verify token properties
    assert_eq!(token_data.token_type, "Bearer");
    assert!(!token_data.access_token.is_empty());
    assert!(token_data.expires_in.is_some());
    
    println!("OAuth 2.0 Authorization Code Flow completed successfully!");
    println!("Access token: {}", token_data.access_token);
}
#[tokio::test]
async fn oauth_discovery_endpoint_should_return_valid_metadata() {
    let environment = std::env::var("ENV").unwrap_or("dev".to_string());
    
    let (api_endpoint, event_bus_name) = retrieve_parameter_values(&environment).await;
    
    let api_driver = ApiDriver::new(
        environment,
        api_endpoint.0.clone(),
        event_bus_name.0.clone(),
    ).await;
    
    // Test OAuth discovery endpoint
    let metadata_response = api_driver
        .get_oauth_metadata()
        .await;
    
    assert_eq!(metadata_response.status(), 200);
    assert_eq!(metadata_response.headers().get("content-type").unwrap(), "application/json");
    
    let metadata: AuthorizationServerMetadata = metadata_response
        .json()
        .await
        .expect("Metadata response should serialize to AuthorizationServerMetadata");
    
    // Verify required fields per RFC 8414
    assert!(!metadata.issuer.is_empty());
    assert!(!metadata.authorization_endpoint.is_empty());
    assert!(!metadata.token_endpoint.is_empty());
    assert!(!metadata.response_types_supported.is_empty());
    
    // Verify expected endpoints
    assert!(metadata.authorization_endpoint.contains("/oauth/authorize"));
    assert!(metadata.token_endpoint.contains("/oauth/token"));
    
    // Verify supported capabilities
    assert!(metadata.response_types_supported.contains(&"code".to_string()));
    assert!(metadata.grant_types_supported.contains(&"authorization_code".to_string()));
    assert!(metadata.scopes_supported.contains(&"openid".to_string()));
    assert!(metadata.scopes_supported.contains(&"profile".to_string()));
    assert!(metadata.scopes_supported.contains(&"email".to_string()));
    
    // Verify PKCE support
    assert!(metadata.code_challenge_methods_supported.contains(&"S256".to_string()));
    assert!(metadata.code_challenge_methods_supported.contains(&"plain".to_string()));
    
    // Verify endpoint URLs
    assert!(metadata.registration_endpoint.is_some());
    assert!(metadata.revocation_endpoint.is_some());
    assert!(metadata.introspection_endpoint.is_some());
    
    if let Some(registration_endpoint) = &metadata.registration_endpoint {
        assert!(registration_endpoint.contains("/oauth/register"));
    }
    
    if let Some(revocation_endpoint) = &metadata.revocation_endpoint {
        assert!(revocation_endpoint.contains("/oauth/revoke"));
    }
    
    if let Some(introspection_endpoint) = &metadata.introspection_endpoint {
        assert!(introspection_endpoint.contains("/oauth/introspect"));
    }
    
    println!("OAuth discovery endpoint test completed successfully!");
    println!("Issuer: {}", metadata.issuer);
    println!("Authorization endpoint: {}", metadata.authorization_endpoint);
    println!("Token endpoint: {}", metadata.token_endpoint);
}

#[tokio::test]
async fn oauth_invalid_authorization_code_should_fail_token_exchange() {
    let environment = std::env::var("ENV").unwrap_or("dev".to_string());
    
    let (api_endpoint, event_bus_name) = retrieve_parameter_values(&environment).await;
    
    let api_driver = ApiDriver::new(
        environment,
        api_endpoint.0.clone(),
        event_bus_name.0.clone(),
    ).await;
    
    // Create a valid OAuth client
    let (client_name, grant_types, redirect_uris, response_types) = OAuthClientBuilder::new()
        .with_client_name("test_invalid_code_client")
        .build();
    
    let client_response = api_driver
        .create_oauth_client(&client_name, grant_types.iter().map(|s| s.as_str()).collect(), redirect_uris.iter().map(|s| s.as_str()).collect(), response_types.iter().map(|s| s.as_str()).collect())
        .await;
    assert_eq!(client_response.status(), 201);
    
    let oauth_client: OAuthClientResponse = client_response
        .json()
        .await
        .expect("OAuth client response should serialize to OAuthClientResponse");
    
    // Test: Try to exchange invalid authorization code for token
    let invalid_code_response = api_driver
        .oauth_token_exchange(
            "authorization_code",
            &oauth_client.client_id,
            Some(&oauth_client.client_secret),
            Some("invalid_authorization_code_12345"),
            Some("http://localhost:3000/callback"),
            None,
            None,
            None,
        )
        .await;
    
    // Should return an error (400 Bad Request)
    assert!(invalid_code_response.status().is_client_error());
    
    println!("OAuth invalid authorization code test completed successfully!");
}

#[tokio::test]
async fn oauth_invalid_redirect_uri_should_be_rejected() {
    let environment = std::env::var("ENV").unwrap_or("dev".to_string());
    
    let (api_endpoint, event_bus_name) = retrieve_parameter_values(&environment).await;
    
    let api_driver = ApiDriver::new(
        environment,
        api_endpoint.0.clone(),
        event_bus_name.0.clone(),
    ).await;
    
    // Create OAuth client with specific redirect URI
    let (client_name, grant_types, redirect_uris, response_types) = OAuthClientBuilder::new()
        .with_client_name("test_redirect_uri_client")
        .with_redirect_uris(vec!["http://localhost:3000/callback".to_string()])
        .build();
    
    let client_response = api_driver
        .create_oauth_client(&client_name, grant_types.iter().map(|s| s.as_str()).collect(), redirect_uris.iter().map(|s| s.as_str()).collect(), response_types.iter().map(|s| s.as_str()).collect())
        .await;
    assert_eq!(client_response.status(), 201);
    
    let oauth_client: OAuthClientResponse = client_response
        .json()
        .await
        .expect("OAuth client response should serialize to OAuthClientResponse");
    
    // Test: Try to authorize with invalid redirect URI
    let invalid_redirect_response = api_driver
        .oauth_authorize_get(
            "code",
            &oauth_client.client_id,
            "http://malicious-site.com/callback", // Invalid redirect URI
            Some("read"),
            Some("test_state"),
            None,
            None,
        )
        .await;
    
    // Should return an error (400 Bad Request)
    assert!(invalid_redirect_response.status().is_client_error());
    
    println!("OAuth invalid redirect URI test completed successfully!");
}

async fn retrieve_parameter_values(environment: &str) -> (ApiEndpoint, EventBusName) {
    let config = aws_config::load_defaults(BehaviorVersion::latest()).await;
    let ssm_client = aws_sdk_ssm::Client::new(&config);

    let service_name = match environment {
        "dev" => "shared",
        "prod" => "shared",
        _ => "Users",
    };

    let api_endpoint = ssm_client
        .get_parameter()
        .name(format!("/{}/Users/api-endpoint", environment))
        .send()
        .await
        .expect("Failed to retrieve API endpoint")
        .parameter
        .expect("API endpoint not found")
        .value
        .expect("API Endpoint value not found");

    let event_bus_name = ssm_client
        .get_parameter()
        .name(format!("/{}/{}/event-bus-name", environment, service_name))
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

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserCreatedEvent {
    user_id: String,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OrderCompleted {
    order_number: String,
    user_id: String
}

#[derive(Deserialize, Serialize, Clone)]
pub struct OAuthClientResponse {
    pub client_id: String,
    pub client_secret: String,
    pub client_name: String,
    pub redirect_uris: Vec<String>,
    pub grant_types: Vec<String>,
    pub scopes: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<u64>,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct IntrospectResponse {
    pub active: bool,
    pub client_id: Option<String>,
    pub username: Option<String>,
    pub exp: Option<u64>,
    pub iat: Option<u64>,
    pub sub: Option<String>,
    pub aud: Option<String>,
    pub scope: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct AuthorizationServerMetadata {
    pub issuer: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub jwks_uri: Option<String>,
    pub scopes_supported: Vec<String>,
    pub response_types_supported: Vec<String>,
    pub grant_types_supported: Vec<String>,
    pub token_endpoint_auth_methods_supported: Vec<String>,
    pub response_modes_supported: Vec<String>,
    pub registration_endpoint: Option<String>,
    pub revocation_endpoint: Option<String>,
    pub introspection_endpoint: Option<String>,
    pub code_challenge_methods_supported: Vec<String>,
}

// Test Data Builders
#[derive(Debug, Clone)]
pub struct OAuthClientBuilder {
    client_name: String,
    grant_types: Vec<String>,
    redirect_uris: Vec<String>,
    response_types: Vec<String>,
}

impl Default for OAuthClientBuilder {
    fn default() -> Self {
        Self {
            client_name: "test_client".to_string(),
            grant_types: vec!["authorization_code".to_string()],
            redirect_uris: vec!["http://localhost:3000/callback".to_string()],
            response_types: vec!["code".to_string()],
        }
    }
}

impl OAuthClientBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_client_name(mut self, client_name: impl Into<String>) -> Self {
        self.client_name = client_name.into();
        self
    }

    pub fn with_grant_types(mut self, grant_types: Vec<String>) -> Self {
        self.grant_types = grant_types;
        self
    }

    pub fn with_redirect_uris(mut self, redirect_uris: Vec<String>) -> Self {
        self.redirect_uris = redirect_uris;
        self
    }

    pub fn with_response_types(mut self, response_types: Vec<String>) -> Self {
        self.response_types = response_types;
        self
    }

    pub fn build(self) -> (String, Vec<String>, Vec<String>, Vec<String>) {
        (
            self.client_name,
            self.grant_types,
            self.redirect_uris,
            self.response_types,
        )
    }
}

#[derive(Debug, Clone)]
pub struct AuthorizeRequestBuilder {
    response_type: String,
    client_id: String,
    redirect_uri: String,
    scope: Option<String>,
    state: Option<String>,
    code_challenge: Option<String>,
    code_challenge_method: Option<String>,
}

impl Default for AuthorizeRequestBuilder {
    fn default() -> Self {
        Self {
            response_type: "code".to_string(),
            client_id: "default".to_string(),
            redirect_uri: "http://localhost:3000/callback".to_string(),
            scope: None,
            state: None,
            code_challenge: None,
            code_challenge_method: None,
        }
    }
}

impl AuthorizeRequestBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_response_type(mut self, response_type: impl Into<String>) -> Self {
        self.response_type = response_type.into();
        self
    }

    pub fn with_client_id(mut self, client_id: impl Into<String>) -> Self {
        self.client_id = client_id.into();
        self
    }

    pub fn with_redirect_uri(mut self, redirect_uri: impl Into<String>) -> Self {
        self.redirect_uri = redirect_uri.into();
        self
    }

    pub fn with_scope(mut self, scope: impl Into<String>) -> Self {
        self.scope = Some(scope.into());
        self
    }

    pub fn with_state(mut self, state: impl Into<String>) -> Self {
        self.state = Some(state.into());
        self
    }

    pub fn with_pkce(mut self, code_verifier: &str) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(code_verifier.as_bytes());
        let hash = hasher.finalize();
        let code_challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&hash);
        
        self.code_challenge = Some(code_challenge);
        self.code_challenge_method = Some("S256".to_string());
        self
    }

    pub fn build(self) -> AuthorizeRequestParams {
        AuthorizeRequestParams {
            response_type: self.response_type,
            client_id: self.client_id,
            redirect_uri: self.redirect_uri,
            scope: self.scope,
            state: self.state,
            code_challenge: self.code_challenge,
            code_challenge_method: self.code_challenge_method,
        }
    }
}

#[derive(Debug, Clone)]
pub struct AuthorizeRequestParams {
    pub response_type: String,
    pub client_id: String,
    pub redirect_uri: String,
    pub scope: Option<String>,
    pub state: Option<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TokenRequestBuilder {
    grant_type: String,
    client_id: String,
    client_secret: Option<String>,
    code: Option<String>,
    redirect_uri: Option<String>,
    code_verifier: Option<String>,
    refresh_token: Option<String>,
    scope: Option<String>,
}

impl Default for TokenRequestBuilder {
    fn default() -> Self {
        Self {
            grant_type: "authorization_code".to_string(),
            client_id: "default".to_string(),
            client_secret: None,
            code: None,
            redirect_uri: None,
            code_verifier: None,
            refresh_token: None,
            scope: None,
        }
    }
}

impl TokenRequestBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_grant_type(mut self, grant_type: impl Into<String>) -> Self {
        self.grant_type = grant_type.into();
        self
    }

    pub fn with_client_id(mut self, client_id: impl Into<String>) -> Self {
        self.client_id = client_id.into();
        self
    }

    pub fn with_client_secret(mut self, client_secret: impl Into<String>) -> Self {
        self.client_secret = Some(client_secret.into());
        self
    }

    pub fn with_code(mut self, code: impl Into<String>) -> Self {
        self.code = Some(code.into());
        self
    }

    pub fn with_redirect_uri(mut self, redirect_uri: impl Into<String>) -> Self {
        self.redirect_uri = Some(redirect_uri.into());
        self
    }

    pub fn with_code_verifier(mut self, code_verifier: impl Into<String>) -> Self {
        self.code_verifier = Some(code_verifier.into());
        self
    }

    pub fn with_refresh_token(mut self, refresh_token: impl Into<String>) -> Self {
        self.refresh_token = Some(refresh_token.into());
        self
    }

    pub fn with_scope(mut self, scope: impl Into<String>) -> Self {
        self.scope = Some(scope.into());
        self
    }

    pub fn build(self) -> TokenRequestParams {
        TokenRequestParams {
            grant_type: self.grant_type,
            client_id: self.client_id,
            client_secret: self.client_secret,
            code: self.code,
            redirect_uri: self.redirect_uri,
            code_verifier: self.code_verifier,
            refresh_token: self.refresh_token,
            scope: self.scope,
        }
    }
}

#[derive(Debug, Clone)]
pub struct TokenRequestParams {
    pub grant_type: String,
    pub client_id: String,
    pub client_secret: Option<String>,
    pub code: Option<String>,
    pub redirect_uri: Option<String>,
    pub code_verifier: Option<String>,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
}

#[derive(Debug, Clone)]
pub struct IntrospectRequestBuilder {
    token: String,
    token_type_hint: Option<String>,
    client_id: String,
    client_secret: Option<String>,
}

impl Default for IntrospectRequestBuilder {
    fn default() -> Self {
        Self {
            token: "".to_string(),
            token_type_hint: None,
            client_id: "default".to_string(),
            client_secret: None,
        }
    }
}

impl IntrospectRequestBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_token(mut self, token: impl Into<String>) -> Self {
        self.token = token.into();
        self
    }

    pub fn with_token_type_hint(mut self, hint: impl Into<String>) -> Self {
        self.token_type_hint = Some(hint.into());
        self
    }

    pub fn with_client_id(mut self, client_id: impl Into<String>) -> Self {
        self.client_id = client_id.into();
        self
    }

    pub fn with_client_secret(mut self, client_secret: impl Into<String>) -> Self {
        self.client_secret = Some(client_secret.into());
        self
    }

    pub fn build(self) -> IntrospectRequestParams {
        IntrospectRequestParams {
            token: self.token,
            token_type_hint: self.token_type_hint,
            client_id: self.client_id,
            client_secret: self.client_secret,
        }
    }
}

#[derive(Debug, Clone)]
pub struct IntrospectRequestParams {
    pub token: String,
    pub token_type_hint: Option<String>,
    pub client_id: String,
    pub client_secret: Option<String>,
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
            .post(format!("{}/user", self.base_url))
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
            .post(format!("{}/login", self.base_url))
            .header("Content-Type", "application/json")
            .body(login_body.to_string())
            .send()
            .await
            .expect("Login user request failed")
    }

    pub async fn get_user_details(&self, email: &str, bearer_token: &str) -> reqwest::Response {
        self.client
            .get(format!("{}/user/{}", self.base_url, email))
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", bearer_token))
            .send()
            .await
            .expect("Get user details request failed")
    }

    pub async fn publish_order_completed_event(&self, email: &str) {
        let payload = CloudEvent::new(
            OrderCompleted {
                user_id: email.to_string(),
                order_number: "ORD123".to_string()
            },
            "orders.orderCompleted.v1".to_string(),
        );
        let payload_string = serde_json::to_string(&payload).expect("Error serde");

        let request = aws_sdk_eventbridge::types::builders::PutEventsRequestEntryBuilder::default()
            .set_source(Some(format!("{}.orders", &self.env)))
            .set_detail_type(Some("orders.orderCompleted.v1".to_string()))
            .set_detail(Some(payload_string))
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

    // OAuth Client Management
    pub async fn create_oauth_client(
        &self,
        client_name: &str,
        grant_types: Vec<&str>,
        redirect_uris: Vec<&str>,
        response_types: Vec<&str>,
    ) -> reqwest::Response {
        let client_body = json!({
            "client_name": client_name,
            "grant_types": grant_types,
            "redirect_uris": redirect_uris,
            "response_types": response_types
        });

        self.client
            .post(format!("{}/oauth/register", self.base_url))
            .header("Content-Type", "application/json")
            .body(client_body.to_string())
            .send()
            .await
            .expect("Create OAuth client request failed")
    }

    // OAuth Authorization Flow
    pub async fn oauth_authorize_get(
        &self,
        response_type: &str,
        client_id: &str,
        redirect_uri: &str,
        scope: Option<&str>,
        state: Option<&str>,
        code_challenge: Option<&str>,
        code_challenge_method: Option<&str>,
    ) -> reqwest::Response {
        let mut url = format!(
            "{}oauth/authorize?response_type={}&client_id={}&redirect_uri={}",
            self.base_url, response_type, client_id, redirect_uri
        );
        
        println!("Full URL: {}", url);

        if let Some(scope) = scope {
            url.push_str(&format!("&scope={}", scope));
        }
        if let Some(state) = state {
            url.push_str(&format!("&state={}", state));
        }
        if let Some(code_challenge) = code_challenge {
            url.push_str(&format!("&code_challenge={}", code_challenge));
        }
        if let Some(code_challenge_method) = code_challenge_method {
            url.push_str(&format!("&code_challenge_method={}", code_challenge_method));
        }

        self.client
            .get(&url)
            .send()
            .await
            .expect("OAuth authorize GET request failed")
    }

    pub async fn oauth_authorize_form_post(
        &self,
        email: &str,
        password: &str,
        client_id: &str,
        redirect_uri: &str,
        scope: Option<&str>,
        state: Option<&str>,
        code_challenge: Option<&str>,
        code_challenge_method: Option<&str>,
        csrf_token: &str,
    ) -> reqwest::Response {
        let mut form_data = HashMap::new();
        form_data.insert("email", email);
        form_data.insert("password", password);
        form_data.insert("client_id", client_id);
        form_data.insert("redirect_uri", redirect_uri);
        form_data.insert("csrf_token", csrf_token);
        form_data.insert("action", "login");

        if let Some(scope) = scope {
            form_data.insert("scope", scope);
        }
        if let Some(state) = state {
            form_data.insert("state", state);
        }
        if let Some(code_challenge) = code_challenge {
            form_data.insert("code_challenge", code_challenge);
        }
        if let Some(code_challenge_method) = code_challenge_method {
            form_data.insert("code_challenge_method", code_challenge_method);
        }

        self.client
            .post(format!("{}/oauth/authorize", self.base_url))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .form(&form_data)
            .send()
            .await
            .expect("OAuth authorize form POST request failed")
    }

    // OAuth Token Exchange
    pub async fn oauth_token_exchange(
        &self,
        grant_type: &str,
        client_id: &str,
        client_secret: Option<&str>,
        code: Option<&str>,
        redirect_uri: Option<&str>,
        code_verifier: Option<&str>,
        refresh_token: Option<&str>,
        scope: Option<&str>,
    ) -> reqwest::Response {
        let mut form_data = HashMap::new();
        form_data.insert("grant_type", grant_type);
        form_data.insert("client_id", client_id);

        if let Some(client_secret) = client_secret {
            form_data.insert("client_secret", client_secret);
        }
        if let Some(code) = code {
            form_data.insert("code", code);
        }
        if let Some(redirect_uri) = redirect_uri {
            form_data.insert("redirect_uri", redirect_uri);
        }
        if let Some(code_verifier) = code_verifier {
            form_data.insert("code_verifier", code_verifier);
        }
        if let Some(refresh_token) = refresh_token {
            form_data.insert("refresh_token", refresh_token);
        }
        if let Some(scope) = scope {
            form_data.insert("scope", scope);
        }

        self.client
            .post(format!("{}/oauth/token", self.base_url))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .form(&form_data)
            .send()
            .await
            .expect("OAuth token exchange request failed")
    }

    // OAuth Discovery
    pub async fn get_oauth_metadata(&self) -> reqwest::Response {
        self.client
            .get(format!("{}/.well-known/oauth-authorization-server", self.base_url))
            .header("Content-Type", "application/json")
            .send()
            .await
            .expect("OAuth metadata request failed")
    }

    pub fn extract_authorization_code_from_redirect(&self, redirect_url: &str) -> Option<String> {
        let url = url::Url::parse(redirect_url).ok()?;
        let query_pairs: std::collections::HashMap<String, String> = url.query_pairs().into_owned().collect();
        query_pairs.get("code").cloned()
    }

    pub fn extract_csrf_token_from_html(&self, html: &str) -> Option<String> {
        // Simple regex to extract CSRF token from HTML form
        let re = regex::Regex::new(r#"name="csrf_token"[^>]*value="([^"]*)"#).ok()?;
        let caps = re.captures(html)?;
        caps.get(1).map(|m| m.as_str().to_string())
    }
}
