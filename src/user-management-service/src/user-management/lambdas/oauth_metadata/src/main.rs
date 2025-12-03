use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Error, Request, RequestExt, Response, Body,
};
use observability::init_otel;
use std::sync::OnceLock;
use opentelemetry_sdk::trace::SdkTracerProvider;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct AuthorizationServerMetadata {
    issuer: String,
    authorization_endpoint: String,
    token_endpoint: String,
    jwks_uri: Option<String>,
    scopes_supported: Vec<String>,
    response_types_supported: Vec<String>,
    grant_types_supported: Vec<String>,
    token_endpoint_auth_methods_supported: Vec<String>,
    response_modes_supported: Vec<String>,
    registration_endpoint: Option<String>,
    revocation_endpoint: Option<String>,
    introspection_endpoint: Option<String>,
    code_challenge_methods_supported: Vec<String>,
    service_documentation: Option<String>,
    ui_locales_supported: Option<Vec<String>>,
    op_policy_uri: Option<String>,
    op_tos_uri: Option<String>,
}

#[instrument(name = "GET /.well-known/oauth-authorization-server", skip(event), fields(http.method = event.method().as_str(), http.path_group = event.raw_http_path()))]
async fn function_handler(event: Request) -> Result<Response<Body>, Error> {
    tracing::info!("Received event: {:?}", event);

    match event.method().as_str() {
        "GET" => handle_metadata_get(event).await,
        _ => {
            tracing::warn!("Method not allowed: {}", event.method());
            Ok(Response::builder()
                .status(StatusCode::METHOD_NOT_ALLOWED)
                .header("Allow", "GET")
                .body("Method Not Allowed".into())
                .unwrap())
        }
    }
}

#[instrument(name = "handle_metadata_get", skip(event))]
async fn handle_metadata_get(event: Request) -> Result<Response<Body>, Error> {
    let host = event
        .headers()
        .get("host")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("localhost");

    let scheme = if event
        .headers()
        .get("x-forwarded-proto")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("https")
        == "https"
    {
        "https"
    } else {
        "http"
    };

    let base_url = format!("{}://{}", scheme, host);
    let api_base_url = format!("{}/oauth", base_url);

    let metadata = AuthorizationServerMetadata {
        issuer: base_url.clone(),
        authorization_endpoint: format!("{}/authorize", api_base_url),
        token_endpoint: format!("{}/token", api_base_url),
        jwks_uri: None, // Can be added when JWKS support is implemented
        scopes_supported: vec![
            "openid".to_string(),
            "profile".to_string(),
            "email".to_string(),
            "read".to_string(),
            "write".to_string(),
        ],
        response_types_supported: vec![
            "code".to_string(),
            "token".to_string(),
            "id_token".to_string(),
            "code token".to_string(),
            "code id_token".to_string(),
            "token id_token".to_string(),
            "code token id_token".to_string(),
        ],
        grant_types_supported: vec![
            "authorization_code".to_string(),
            "implicit".to_string(),
            "refresh_token".to_string(),
            "client_credentials".to_string(),
        ],
        token_endpoint_auth_methods_supported: vec![
            "client_secret_basic".to_string(),
            "client_secret_post".to_string(),
            "none".to_string(), // For PKCE public clients
        ],
        response_modes_supported: vec![
            "query".to_string(),
            "fragment".to_string(),
            "form_post".to_string(),
        ],
        registration_endpoint: Some(format!("{}/register", api_base_url)),
        revocation_endpoint: Some(format!("{}/revoke", api_base_url)),
        introspection_endpoint: Some(format!("{}/introspect", api_base_url)),
        code_challenge_methods_supported: vec![
            "plain".to_string(),
            "S256".to_string(),
        ],
        service_documentation: Some(format!("{}/docs", api_base_url)),
        ui_locales_supported: Some(vec!["en".to_string()]),
        op_policy_uri: None,
        op_tos_uri: None,
    };

    tracing::info!("Returning OAuth authorization server metadata");
    
    // Return raw JSON without wrapper as per RFC 8414
    let json_body = serde_json::to_string(&metadata).unwrap_or("{}".to_string());
    
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Headers", "Content-Type")
        .header("Access-Control-Allow-Methods", "GET")
        .body(Body::Text(json_body))
        .map_err(Box::new)?)
}

static TRACER_PROVIDER: OnceLock<SdkTracerProvider> = OnceLock::new();

#[tokio::main]
async fn main() -> Result<(), Error> {
    let otel_providers = match init_otel() {
        Ok(providers) => Some(providers),
        Err(err) => {
            tracing::warn!(
                "Couldn't start OTel! Will proudly soldier on without telemetry: {0}",
                err
            );
            None
        }
    };

    let _ = TRACER_PROVIDER.set(otel_providers.unwrap().0);

    run(service_fn(|event| async {
        let res = function_handler(event).await;

        if let Some(provider) = TRACER_PROVIDER.get() {
            if let Err(e) = provider.force_flush() {
                tracing::warn!("Failed to flush traces: {:?}", e);
            }
        }

        res
    }))
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use lambda_http::{http::Method, Request, Body, http::HeaderName, http::HeaderValue};
    use serde_json::Value;
    use std::collections::HashMap;

    fn create_test_request(method: Method, headers: HashMap<String, String>) -> Request {
        let mut request = Request::new(Body::Empty);
        *request.method_mut() = method;
        *request.uri_mut() = "/.well-known/oauth-authorization-server".parse().unwrap();
        
        let request_headers = request.headers_mut();
        for (key, value) in headers {
            let header_name = HeaderName::from_bytes(key.as_bytes()).unwrap();
            let header_value = HeaderValue::from_str(&value).unwrap();
            request_headers.insert(header_name, header_value);
        }
        
        request
    }

    #[tokio::test]
    async fn test_metadata_endpoint_returns_valid_json() {
        let mut headers = HashMap::new();
        headers.insert("host".to_string(), "example.com".to_string());
        headers.insert("x-forwarded-proto".to_string(), "https".to_string());
        
        let request = create_test_request(Method::GET, headers);
        let response = function_handler(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body = match response.body() {
            Body::Text(text) => text.clone(),
            _ => panic!("Expected text body"),
        };

        let metadata: Value = serde_json::from_str(&body).unwrap();
        assert_eq!(metadata["issuer"], "https://example.com");
        assert_eq!(metadata["authorization_endpoint"], "https://example.com/oauth/authorize");
        assert_eq!(metadata["token_endpoint"], "https://example.com/oauth/token");
        assert!(metadata["response_types_supported"].is_array());
        assert!(metadata["grant_types_supported"].is_array());
    }

    #[tokio::test]
    async fn test_metadata_endpoint_method_not_allowed() {
        let mut headers = HashMap::new();
        headers.insert("host".to_string(), "example.com".to_string());
        
        let request = create_test_request(Method::POST, headers);
        let response = function_handler(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    }

    #[tokio::test]
    async fn test_metadata_endpoint_includes_required_fields() {
        let mut headers = HashMap::new();
        headers.insert("host".to_string(), "test.example.com".to_string());
        headers.insert("x-forwarded-proto".to_string(), "https".to_string());
        
        let request = create_test_request(Method::GET, headers);
        let response = function_handler(request).await.unwrap();
        
        let body = match response.body() {
            Body::Text(text) => text.clone(),
            _ => panic!("Expected text body"),
        };

        let metadata: Value = serde_json::from_str(&body).unwrap();
        
        // Check required fields per RFC 8414
        assert!(metadata["issuer"].is_string());
        assert!(metadata["response_types_supported"].is_array());
        
        // Check common optional fields
        assert!(metadata["authorization_endpoint"].is_string());
        assert!(metadata["token_endpoint"].is_string());
        assert!(metadata["scopes_supported"].is_array());
        assert!(metadata["grant_types_supported"].is_array());
        assert!(metadata["token_endpoint_auth_methods_supported"].is_array());
        assert!(metadata["code_challenge_methods_supported"].is_array());
    }
}