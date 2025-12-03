use crate::{
    core::{
        AuthorizationCode, EventPublisher, GrantType, OAuthClient, OAuthClientCreatedDTO,
        OAuthClientDTO, OAuthToken, Repository, RepositoryError, TokenEndpointAuthMethod, User,
        UserDTO,
    },
    tokens::TokenGenerator,
};
use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};
use chrono::{Duration, Utc};
use lambda_http::tracing::log::warn;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::{Span, instrument};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use urlencoding::decode;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum ApplicationError {
    #[error("Product not found")]
    NotFound,
    #[error("Error: {0}")]
    InvalidInput(String),
    #[error("Error: {0}")]
    InternalError(String),
    #[error("Provided Password Invalid")]
    InvalidPassword(),
    #[error("Invalid authentication token")]
    InvalidToken(),
}

#[derive(Deserialize)]
pub struct GetUserDetailsQuery {
    email_address: String,
}

impl GetUserDetailsQuery {
    pub fn new(email_address: String) -> Self {
        GetUserDetailsQuery { email_address }
    }

    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<UserDTO, ApplicationError> {
        Span::current().set_attribute("user.id", self.email_address.clone());

        let res = repository.get_user(&self.email_address).await;

        match res {
            Ok(user) => Ok(user.as_dto()),
            Err(e) => match e {
                RepositoryError::NotFound => Err(ApplicationError::NotFound),
                RepositoryError::InternalError(e) => {
                    Err(ApplicationError::InternalError(e.to_string()))
                }
                _ => Err(ApplicationError::InternalError(e.to_string())),
            },
        }
    }
}

#[derive(Deserialize)]
pub struct CreateUserCommand {
    email_address: String,
    first_name: String,
    last_name: String,
    password: String,
    admin_user: Option<bool>,
}

impl CreateUserCommand {
    pub fn new(
        email_address: String,
        first_name: String,
        last_name: String,
        password: String,
    ) -> Self {
        CreateUserCommand {
            email_address,
            first_name,
            last_name,
            password,
            admin_user: None,
        }
    }
    pub fn new_admin_user(
        email_address: String,
        first_name: String,
        last_name: String,
        password: String,
    ) -> Self {
        CreateUserCommand {
            email_address,
            first_name,
            last_name,
            password,
            admin_user: Some(true),
        }
    }

    pub async fn handle<TRepo: Repository, TEventPublisher: EventPublisher>(
        &self,
        repository: &TRepo,
        event_publisher: &TEventPublisher,
    ) -> Result<UserDTO, ApplicationError> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(self.password.as_bytes(), &salt)
            .map_err(|_e| ApplicationError::InternalError(_e.to_string()))?
            .to_string();

        let user = match &self.admin_user {
            None => User::new(
                self.email_address.clone(),
                self.first_name.clone(),
                self.last_name.clone(),
                hash,
            ),
            Some(_) => User::new_admin(
                self.email_address.clone(),
                self.first_name.clone(),
                self.last_name.clone(),
                hash,
            ),
        };

        let _res = repository.update_user_details(&user).await;

        event_publisher
            .publish_user_created_event(user.clone().into())
            .await
            .map_err(|_e| {
                ApplicationError::InternalError("Failure publishing event".to_string())
            })?;

        Ok(user.as_dto())
    }
}

#[derive(Deserialize)]
pub struct LoginCommand {
    email_address: String,
    password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    token: String,
}

pub async fn handle_login<TRepo: Repository>(
    repository: &TRepo,
    token_generator: &TokenGenerator,
    login_command: LoginCommand,
) -> Result<LoginResponse, ApplicationError> {
    Span::current().set_attribute("user.id", login_command.email_address.clone());

    let user = repository
        .get_user(&login_command.email_address)
        .await
        .map_err(|e| match e {
            RepositoryError::NotFound => ApplicationError::NotFound,
            RepositoryError::InternalError(e) => {
                Span::current().set_attribute("login.status", e.to_string());
                ApplicationError::InternalError(e.to_string())
            }
            _ => ApplicationError::InternalError(e.to_string()),
        })?;

    let parsed_hash = PasswordHash::new(user.get_password_hash())
        .map_err(|_e| ApplicationError::InternalError(_e.to_string()))?;
    Argon2::default()
        .verify_password(login_command.password.as_bytes(), &parsed_hash)
        .map_err(|_e| {
            Span::current().set_attribute("login.status", "invalid_password");
            ApplicationError::InvalidPassword()
        })?;

    let token = token_generator.generate_token(user);

    Ok(LoginResponse { token })
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderCompleted {
    order_number: String,
    user_id: String,
}

impl OrderCompleted {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<(), ApplicationError> {
        Span::current().set_attribute("user.id", self.user_id.clone());
        Span::current().set_attribute("order.number", self.order_number.clone());

        let mut user = repository
            .get_user(&self.user_id)
            .await
            .map_err(|e| match e {
                RepositoryError::NotFound => ApplicationError::NotFound,
                RepositoryError::InternalError(e) => ApplicationError::InternalError(e.to_string()),
                _ => ApplicationError::InternalError(e.to_string()),
            })?;

        user.order_placed();

        let _res = repository.update_user_details(&user).await;

        Ok(())
    }
}

// OAuth Client Commands and Queries

#[derive(Deserialize)]
pub struct CreateOAuthClientCommand {
    #[serde(rename = "client_name")]
    pub client_name: String,
    #[serde(rename = "redirect_uris")]
    pub redirect_uris: Vec<String>,
    #[serde(rename = "grant_types")]
    pub grant_types: Vec<String>,
    #[serde(rename = "response_types")]
    pub response_types: Vec<String>,
}

impl CreateOAuthClientCommand {
    #[instrument(name = "handle", skip(self, repository))]
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<OAuthClientCreatedDTO, ApplicationError> {
        Span::current().set_attribute("oauth.client_name", self.client_name.clone());

        // Validate input
        if self.client_name.is_empty() {
            return Err(ApplicationError::InvalidInput(
                "Client name is required".to_string(),
            ));
        }

        if self.redirect_uris.is_empty() {
            return Err(ApplicationError::InvalidInput(
                "At least one redirect URI is required".to_string(),
            ));
        }

        // Validate redirect URIs
        for uri in &self.redirect_uris {
            if !uri.starts_with("https://") && !uri.starts_with("http://localhost") {
                return Err(ApplicationError::InvalidInput(
                    "Redirect URIs must use HTTPS or localhost".to_string(),
                ));
            }
        }

        // Parse grant types
        let grant_types: Result<Vec<GrantType>, ApplicationError> = self
            .grant_types
            .iter()
            .map(|s| match s.as_str() {
                "authorization_code" => Ok(GrantType::AuthorizationCode),
                "client_credentials" => Ok(GrantType::ClientCredentials),
                "refresh_token" => Ok(GrantType::RefreshToken),
                "implicit" => Ok(GrantType::Implicit),
                _ => Err(ApplicationError::InvalidInput(format!(
                    "Invalid grant type: {}",
                    s
                ))),
            })
            .collect();

        let grant_types = grant_types?;

        if grant_types.is_empty() {
            return Err(ApplicationError::InvalidInput(
                "At least one grant type is required".to_string(),
            ));
        }

        // Create OAuth client
        let client = OAuthClient::new(
            self.client_name.clone(),
            self.redirect_uris.clone(),
            grant_types,
            vec![
                "read".to_string(),
                "write".to_string(),
                "email".to_string(),
                "openid".to_string(),
                "profile".to_string(),
            ],
            TokenEndpointAuthMethod::ClientSecretPost,
        );

        // Store client
        repository.create_oauth_client(&client).await.map_err(|e| {
            ApplicationError::InternalError(format!("Failed to create OAuth client: {}", e))
        })?;

        // Return created client with secret
        Ok(OAuthClientCreatedDTO {
            client_id: client.client_id,
            client_secret: client.client_secret,
            client_name: client.client_name,
            redirect_uris: client.redirect_uris,
            grant_types: client
                .grant_types
                .iter()
                .map(|g| format!("{:?}", g))
                .collect(),
            scopes: client.scopes,
            created_at: client.created_at,
        })
    }
}

#[derive(Deserialize)]
pub struct GetOAuthClientQuery {
    #[serde(rename = "clientId")]
    pub client_id: String,
}

impl GetOAuthClientQuery {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<OAuthClientDTO, ApplicationError> {
        Span::current().set_attribute("oauth.client_id", self.client_id.clone());

        let client = repository
            .get_oauth_client(&self.client_id)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to get OAuth client: {}", e))
            })?
            .ok_or(ApplicationError::NotFound)?;

        Ok(client.as_dto())
    }
}

#[derive(Deserialize)]
pub struct UpdateOAuthClientCommand {
    #[serde(rename = "client_id")]
    pub client_id: String,
    #[serde(rename = "client_name")]
    pub client_name: Option<String>,
    #[serde(rename = "redirect_uris")]
    pub redirect_uris: Option<Vec<String>>,
    pub scopes: Option<Vec<String>>,
    #[serde(rename = "client_uri")]
    pub client_uri: Option<String>,
    #[serde(rename = "logo_uri")]
    pub logo_uri: Option<String>,
    pub contacts: Option<Vec<String>>,
}

impl UpdateOAuthClientCommand {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<OAuthClientDTO, ApplicationError> {
        Span::current().set_attribute("oauth.client_id", self.client_id.clone());

        let mut client = repository
            .get_oauth_client(&self.client_id)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to get OAuth client: {}", e))
            })?
            .ok_or(ApplicationError::NotFound)?;

        // Validate redirect URIs if provided
        if let Some(ref redirect_uris) = self.redirect_uris {
            for uri in redirect_uris {
                if !uri.starts_with("https://") && !uri.starts_with("http://localhost") {
                    return Err(ApplicationError::InvalidInput(
                        "Redirect URIs must use HTTPS or localhost".to_string(),
                    ));
                }
            }
        }

        // Update client
        client.update(
            self.client_name.clone(),
            self.redirect_uris.clone(),
            self.scopes.clone(),
        );

        // Save updated client
        repository.update_oauth_client(&client).await.map_err(|e| {
            ApplicationError::InternalError(format!("Failed to update OAuth client: {}", e))
        })?;

        Ok(client.as_dto())
    }
}

#[derive(Deserialize)]
pub struct DeleteOAuthClientCommand {
    #[serde(rename = "clientId")]
    pub client_id: String,
}

impl DeleteOAuthClientCommand {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<(), ApplicationError> {
        Span::current().set_attribute("oauth.client_id", self.client_id.clone());

        // Check if client exists
        let client = repository
            .get_oauth_client(&self.client_id)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to get OAuth client: {}", e))
            })?
            .ok_or(ApplicationError::NotFound)?;

        // Revoke all tokens for this client
        repository
            .revoke_all_tokens_for_client(&client.client_id)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to revoke tokens: {}", e))
            })?;

        // Delete the client
        repository
            .delete_oauth_client(&self.client_id)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to delete OAuth client: {}", e))
            })?;

        Ok(())
    }
}

#[derive(Deserialize)]
pub struct ListOAuthClientsQuery {
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

impl ListOAuthClientsQuery {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<Vec<OAuthClientDTO>, ApplicationError> {
        let clients = repository
            .list_oauth_clients(self.page, self.limit)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to list OAuth clients: {}", e))
            })?;

        Ok(clients.into_iter().map(|c| c.as_dto()).collect())
    }
}

#[derive(Deserialize)]
pub struct ValidateClientCredentialsQuery {
    #[serde(rename = "clientId")]
    pub client_id: String,
    #[serde(rename = "clientSecret")]
    pub client_secret: String,
}

impl ValidateClientCredentialsQuery {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<bool, ApplicationError> {
        Span::current().set_attribute("oauth.client_id", self.client_id.clone());
        let is_valid = repository
            .validate_client_secret(&self.client_id, &self.client_secret)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!(
                    "Failed to validate client credentials: {}",
                    e
                ))
            })?;

        Ok(is_valid)
    }
}

// OAuth 2.0 Authorization Flow Handlers

#[derive(Deserialize)]
pub struct AuthorizeRequest {
    pub response_type: String,
    pub client_id: String,
    pub redirect_uri: String,
    pub scope: Option<String>,
    pub state: Option<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
}

#[derive(Serialize)]
pub struct AuthorizeResponse {
    pub authorization_url: String,
}

#[derive(Serialize, Clone)]
pub struct AuthorizeHtmlResponse {
    pub html_content: String,
}

impl AuthorizeRequest {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<AuthorizeResponse, ApplicationError> {
        Span::current().set_attribute("oauth.client_id", self.client_id.clone());
        // Validate response_type
        if self.response_type != "code" {
            return Err(ApplicationError::InvalidInput(
                "Only 'code' response type is supported".to_string(),
            ));
        }

        // Validate client
        let client = repository
            .get_oauth_client(&self.client_id)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to get OAuth client: {}", e))
            })?
            .ok_or(ApplicationError::InvalidInput(
                "Invalid client_id".to_string(),
            ))?;

        // Validate redirect_uri
        if !client.redirect_uris.contains(&self.redirect_uri) {
            return Err(ApplicationError::InvalidInput(
                "Invalid redirect_uri".to_string(),
            ));
        }

        // Validate grant type
        if !client.grant_types.contains(&GrantType::AuthorizationCode) {
            return Err(ApplicationError::InvalidInput(
                "Client not authorized for authorization_code grant".to_string(),
            ));
        }

        // Validate scope
        if let Some(requested_scope) = &self.scope {
            let requested_scopes: Vec<&str> = requested_scope.split(' ').collect();
            for scope in requested_scopes {
                if !client.scopes.contains(&scope.to_string()) {
                    return Err(ApplicationError::InvalidInput(format!(
                        "Invalid scope: {}",
                        scope
                    )));
                }
            }
        }

        // For production, this would redirect to login page
        // For now, we'll create a placeholder authorization URL
        let authorization_url = format!(
            "/oauth/authorize?response_type={}&client_id={}&redirect_uri={}&scope={}&state={}",
            self.response_type,
            self.client_id,
            self.redirect_uri,
            self.scope.as_deref().unwrap_or(""),
            self.state.as_deref().unwrap_or("")
        );

        Ok(AuthorizeResponse { authorization_url })
    }

    pub async fn handle_html<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<AuthorizeHtmlResponse, ApplicationError> {
        Span::current().set_attribute("oauth.client_id", self.client_id.clone());
        // Validate response_type
        if self.response_type != "code" {
            return Err(ApplicationError::InvalidInput(format!(
                "Only 'code' response type is supported. Current request is for '{}'",
                &self.response_type
            )));
        }

        // Validate client
        let client = repository
            .get_oauth_client(&self.client_id)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to get OAuth client: {}", e))
            })?
            .ok_or(ApplicationError::InvalidInput(
                "Invalid client_id".to_string(),
            ))?;

        // Validate redirect_uri
        if !client.redirect_uris.contains(&self.redirect_uri) {
            return Err(ApplicationError::InvalidInput(
                "Invalid redirect_uri".to_string(),
            ));
        }

        // Validate grant type
        if !client.grant_types.contains(&GrantType::AuthorizationCode) {
            return Err(ApplicationError::InvalidInput(
                "Client not authorized for authorization_code grant".to_string(),
            ));
        }

        // Validate scope
        if let Some(requested_scope) = &self.scope {
            let requested_scopes: Vec<&str> = requested_scope.split(' ').collect();
            for scope in requested_scopes {
                if !client.scopes.contains(&scope.to_string()) {
                    return Err(ApplicationError::InvalidInput(format!(
                        "Invalid scope: {}",
                        scope
                    )));
                }
            }
        }

        // Generate HTML login page
        use crate::html_templates::{LoginPageTemplate, generate_csrf_token};

        let csrf_token = generate_csrf_token();
        let login_page = LoginPageTemplate::new(
            self.client_id.clone(),
            self.redirect_uri.clone(),
            self.scope.as_deref().unwrap_or("").to_string(),
            self.state.as_deref().unwrap_or("").to_string(),
            self.code_challenge.as_deref().unwrap_or("").to_string(),
            self.code_challenge_method
                .as_deref()
                .unwrap_or("")
                .to_string(),
            csrf_token,
        );

        Ok(AuthorizeHtmlResponse {
            html_content: login_page.render(),
        })
    }
}

#[derive(Deserialize)]
pub struct AuthorizeCallbackCommand {
    pub client_id: String,
    pub redirect_uri: String,
    pub user_id: String,
    pub scope: Option<String>,
    pub state: Option<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
}

#[derive(Serialize)]
pub struct AuthorizeCallbackResponse {
    pub redirect_url: String,
}

impl AuthorizeCallbackCommand {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<AuthorizeCallbackResponse, ApplicationError> {
        Span::current().set_attribute("oauth.client_id", self.client_id.clone());
        Span::current().set_attribute("user.id", self.user_id.clone());
        // Validate client
        let client = repository
            .get_oauth_client(&self.client_id)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to get OAuth client: {}", e))
            })?
            .ok_or(ApplicationError::InvalidInput(
                "Invalid client_id".to_string(),
            ))?;

        // Validate redirect_uri
        if !client.redirect_uris.contains(&self.redirect_uri) {
            return Err(ApplicationError::InvalidInput(
                "Invalid redirect_uri".to_string(),
            ));
        }

        // Generate authorization code
        let code = Uuid::new_v4().to_string();
        let now = Utc::now();

        let auth_code = AuthorizationCode {
            code: code.clone(),
            client_id: self.client_id.clone(),
            user_id: self.user_id.clone(),
            redirect_uri: self.redirect_uri.clone(),
            scopes: self
                .scope
                .clone()
                .unwrap_or_default()
                .split(' ')
                .map(|s| s.to_string())
                .collect(),
            code_challenge: self.code_challenge.clone(),
            code_challenge_method: self.code_challenge_method.clone(),
            expires_at: now + Duration::seconds(600), // 10 minutes
            is_used: false,
            created_at: now,
        };

        // Store authorization code
        repository
            .store_authorization_code(&auth_code)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!(
                    "Failed to store authorization code: {}",
                    e
                ))
            })?;

        // Build redirect URL
        let mut redirect_url = format!("{}?code={}", self.redirect_uri, code);
        if let Some(state) = &self.state {
            redirect_url.push_str(&format!("&state={}", state));
        }

        Ok(AuthorizeCallbackResponse { redirect_url })
    }
}

#[derive(Deserialize)]
pub struct LoginFormCommand {
    pub email: String,
    pub password: String,
    pub client_id: String,
    pub redirect_uri: String,
    pub scope: String,
    pub state: String,
    pub code_challenge: String,
    pub code_challenge_method: String,
    pub csrf_token: String,
    pub action: String,
}

#[derive(Serialize)]
pub struct LoginFormResponse {
    pub success: bool,
    pub redirect_url: Option<String>,
    pub html_content: Option<String>,
}

impl LoginFormCommand {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<LoginFormResponse, ApplicationError> {
        Span::current().set_attribute("oauth.client_id", self.client_id.clone());
        // Validate action
        if self.action != "login" {
            return Err(ApplicationError::InvalidInput("Invalid action".to_string()));
        }

        // Validate client
        let client = repository
            .get_oauth_client(&self.client_id)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to get OAuth client: {}", e))
            })?
            .ok_or(ApplicationError::InvalidInput(
                "Invalid client_id".to_string(),
            ))?;

        // Validate redirect_uri
        if !client.redirect_uris.contains(&self.redirect_uri) {
            return Err(ApplicationError::InvalidInput(
                "Invalid redirect_uri".to_string(),
            ));
        }

        // Authenticate user
        let user = repository.get_user(&self.email).await;

        let authenticated_user = match user {
            Ok(u) => {
                // Validate password using Argon2 (same as existing login logic)
                use argon2::{Argon2, PasswordHash, PasswordVerifier};

                let parsed_hash = PasswordHash::new(u.get_password_hash())
                    .map_err(|_e| ApplicationError::InternalError(_e.to_string()))?;

                let password_valid = Argon2::default()
                    .verify_password(self.password.as_bytes(), &parsed_hash)
                    .is_ok();

                if password_valid {
                    u
                } else {
                    // Return HTML login page with error
                    use crate::html_templates::{LoginPageTemplate, generate_csrf_token};

                    let csrf_token = generate_csrf_token();
                    let login_page = LoginPageTemplate::new(
                        self.client_id.clone(),
                        self.redirect_uri.clone(),
                        self.scope.clone(),
                        self.state.clone(),
                        self.code_challenge.clone(),
                        self.code_challenge_method.clone(),
                        csrf_token,
                    )
                    .with_error("Invalid email or password".to_string());

                    return Ok(LoginFormResponse {
                        success: false,
                        redirect_url: None,
                        html_content: Some(login_page.render()),
                    });
                }
            }
            Err(_) => {
                // Return HTML login page with error
                use crate::html_templates::{LoginPageTemplate, generate_csrf_token};

                let csrf_token = generate_csrf_token();
                let login_page = LoginPageTemplate::new(
                    self.client_id.clone(),
                    self.redirect_uri.clone(),
                    self.scope.clone(),
                    self.state.clone(),
                    self.code_challenge.clone(),
                    self.code_challenge_method.clone(),
                    csrf_token,
                )
                .with_error("Invalid email or password".to_string());

                return Ok(LoginFormResponse {
                    success: false,
                    redirect_url: None,
                    html_content: Some(login_page.render()),
                });
            }
        };

        // Generate authorization code (similar to AuthorizeCallbackCommand)
        let code = Uuid::new_v4().to_string();
        let now = Utc::now();

        let auth_code = AuthorizationCode {
            code: code.clone(),
            client_id: self.client_id.clone(),
            user_id: match &authenticated_user {
                User::Standard(details) => details.user_id.clone(),
                User::Premium(details) => details.user_id.clone(),
                User::Admin(details) => details.user_id.clone(),
            },
            redirect_uri: self.redirect_uri.clone(),
            scopes: self.scope.split(' ').map(|s| s.to_string()).collect(),
            code_challenge: Some(self.code_challenge.clone()),
            code_challenge_method: Some(self.code_challenge_method.clone()),
            expires_at: now + Duration::seconds(600), // 10 minutes
            is_used: false,
            created_at: now,
        };

        // Store authorization code
        repository
            .store_authorization_code(&auth_code)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!(
                    "Failed to store authorization code: {}",
                    e
                ))
            })?;

        // Build redirect URL
        let mut redirect_url = format!("{}?code={}", self.redirect_uri, code);
        if !self.state.is_empty() {
            redirect_url.push_str(&format!("&state={}", self.state));
        }

        Ok(LoginFormResponse {
            success: true,
            redirect_url: Some(redirect_url),
            html_content: None,
        })
    }
}

#[derive(Deserialize)]
pub struct TokenRequest {
    pub grant_type: String,
    pub code: Option<String>,
    pub redirect_uri: Option<String>,
    pub client_id: String,
    pub client_secret: Option<String>,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
    pub code_verifier: Option<String>,
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
}

impl TokenRequest {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
        token_generator: &TokenGenerator,
    ) -> Result<TokenResponse, ApplicationError> {
        Span::current().set_attribute("oauth.client_id", self.client_id.clone());
        match self.grant_type.as_str() {
            "authorization_code" => {
                self.handle_authorization_code(repository, token_generator)
                    .await
            }
            "refresh_token" => self.handle_refresh_token(repository, token_generator).await,
            "client_credentials" => {
                self.handle_client_credentials(repository, token_generator)
                    .await
            }
            _ => Err(ApplicationError::InvalidInput(
                "Unsupported grant type".to_string(),
            )),
        }
    }

    async fn handle_authorization_code<TRepo: Repository>(
        &self,
        repository: &TRepo,
        token_generator: &TokenGenerator,
    ) -> Result<TokenResponse, ApplicationError> {
        let code = self.code.as_ref().ok_or(ApplicationError::InvalidInput(
            "Code is required for authorization_code grant".to_string(),
        ))?;

        let redirect_uri = self
            .redirect_uri
            .as_ref()
            .ok_or(ApplicationError::InvalidInput(
                "Redirect URI is required for authorization_code grant".to_string(),
            ))?;

        // Get authorization code
        let auth_code = repository
            .get_authorization_code(code)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to get authorization code: {}", e))
            })?
            .ok_or(ApplicationError::InvalidInput(
                "Invalid authorization code".to_string(),
            ))?;

        // Validate authorization code
        let now = Utc::now();

        if auth_code.expires_at < now {
            return Err(ApplicationError::InvalidInput(
                "Authorization code has expired".to_string(),
            ));
        }

        if decode(&auth_code.redirect_uri) != decode(redirect_uri) {
            warn!(
                "Redirect URI mismatch: expected '{}', got '{}'",
                redirect_uri, auth_code.redirect_uri
            );
            return Err(ApplicationError::InvalidInput(
                "Redirect URI mismatch".to_string(),
            ));
        }

        // Validate PKCE if present
        if let Some(code_challenge) = &auth_code.code_challenge {
            // The code challenge property might exist, but be empty.
            if !code_challenge.is_empty() {
                let code_verifier =
                    self.code_verifier
                        .as_ref()
                        .ok_or(ApplicationError::InvalidInput(
                            "Code verifier is required for PKCE".to_string(),
                        ))?;

                if !self.validate_pkce(
                    code_verifier,
                    code_challenge,
                    &auth_code.code_challenge_method,
                ) {
                    return Err(ApplicationError::InvalidInput(
                        "Invalid code verifier".to_string(),
                    ));
                }
            }
        }

        // Validate client secret if not using PKCE
        if auth_code.code_challenge.is_none() {
            let client_secret =
                self.client_secret
                    .as_ref()
                    .ok_or(ApplicationError::InvalidInput(
                        "Client secret is required".to_string(),
                    ))?;

            if !repository
                .validate_client_secret(&self.client_id, client_secret)
                .await
                .map_err(|e| {
                    ApplicationError::InternalError(format!(
                        "Failed to validate client secret: {}",
                        e
                    ))
                })?
            {
                return Err(ApplicationError::InvalidInput(
                    "Invalid client secret".to_string(),
                ));
            }
        }

        // Get user for token generation
        let user = repository
            .get_user(&auth_code.user_id)
            .await
            .map_err(|e| ApplicationError::InternalError(format!("Failed to get user: {}", e)))?;

        // Generate tokens
        let access_token = token_generator.generate_token(user);
        let refresh_token = Uuid::new_v4().to_string();

        let oauth_token = OAuthToken {
            access_token: access_token.clone(),
            refresh_token: Some(refresh_token.clone()),
            token_type: "Bearer".to_string(),
            expires_in: 3600, // 1 hour
            scope: auth_code.scopes.join(" "),
            client_id: self.client_id.clone(),
            user_id: auth_code.user_id.clone(),
            expires_at: now + Duration::seconds(3600),
            is_revoked: false,
            created_at: now,
        };

        // Store token
        repository
            .store_oauth_token(&oauth_token)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to store OAuth token: {}", e))
            })?;

        // Delete authorization code (one-time use)
        repository
            .revoke_authorization_code(code)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!(
                    "Failed to revoke authorization code: {}",
                    e
                ))
            })?;

        Ok(TokenResponse {
            access_token,
            token_type: "Bearer".to_string(),
            expires_in: 3600,
            refresh_token: Some(refresh_token),
            scope: Some(auth_code.scopes.join(" ")),
        })
    }

    async fn handle_refresh_token<TRepo: Repository>(
        &self,
        repository: &TRepo,
        token_generator: &TokenGenerator,
    ) -> Result<TokenResponse, ApplicationError> {
        Span::current().set_attribute("oauth.client_id", self.client_id.clone());

        let refresh_token = self
            .refresh_token
            .as_ref()
            .ok_or(ApplicationError::InvalidInput(
                "Refresh token is required".to_string(),
            ))?;

        // Get token by refresh token
        let oauth_token = repository
            .get_oauth_token_by_refresh(refresh_token)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to get OAuth token: {}", e))
            })?
            .ok_or(ApplicationError::InvalidInput(
                "Invalid refresh token".to_string(),
            ))?;

        // Validate client
        if oauth_token.client_id != self.client_id {
            return Err(ApplicationError::InvalidInput(
                "Client ID mismatch".to_string(),
            ));
        }

        // Validate client secret
        if let Some(client_secret) = &self.client_secret
            && !repository
                .validate_client_secret(&self.client_id, client_secret)
                .await
                .map_err(|e| {
                    ApplicationError::InternalError(format!(
                        "Failed to validate client secret: {}",
                        e
                    ))
                })?
        {
            return Err(ApplicationError::InvalidInput(
                "Invalid client secret".to_string(),
            ));
        }

        // Get user for token generation
        let user = repository
            .get_user(&oauth_token.user_id)
            .await
            .map_err(|e| ApplicationError::InternalError(format!("Failed to get user: {}", e)))?;

        // Generate new access token
        let access_token = token_generator.generate_token(user);
        let new_refresh_token = Uuid::new_v4().to_string();

        let now = Utc::now();

        let new_oauth_token = OAuthToken {
            access_token: access_token.clone(),
            refresh_token: Some(new_refresh_token.clone()),
            token_type: "Bearer".to_string(),
            expires_in: 3600, // 1 hour
            scope: oauth_token.scope.clone(),
            client_id: self.client_id.clone(),
            user_id: oauth_token.user_id.clone(),
            expires_at: now + Duration::seconds(3600),
            is_revoked: false,
            created_at: now,
        };

        // Store new token
        repository
            .store_oauth_token(&new_oauth_token)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to store OAuth token: {}", e))
            })?;

        // Revoke old token
        repository
            .revoke_oauth_token(&oauth_token.access_token)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to revoke old token: {}", e))
            })?;

        Ok(TokenResponse {
            access_token,
            token_type: "Bearer".to_string(),
            expires_in: 3600,
            refresh_token: Some(new_refresh_token),
            scope: Some(oauth_token.scope),
        })
    }

    async fn handle_client_credentials<TRepo: Repository>(
        &self,
        repository: &TRepo,
        _: &TokenGenerator,
    ) -> Result<TokenResponse, ApplicationError> {
        Span::current().set_attribute("oauth.client_id", self.client_id.clone());

        let client_secret = self
            .client_secret
            .as_ref()
            .ok_or(ApplicationError::InvalidInput(
                "Client secret is required for client_credentials grant".to_string(),
            ))?;

        // Validate client credentials
        if !repository
            .validate_client_secret(&self.client_id, client_secret)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to validate client secret: {}", e))
            })?
        {
            return Err(ApplicationError::InvalidInput(
                "Invalid client credentials".to_string(),
            ));
        }

        // Get client
        let client = repository
            .get_oauth_client(&self.client_id)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to get OAuth client: {}", e))
            })?
            .ok_or(ApplicationError::InvalidInput(
                "Invalid client_id".to_string(),
            ))?;

        // Validate grant type
        if !client.grant_types.contains(&GrantType::ClientCredentials) {
            return Err(ApplicationError::InvalidInput(
                "Client not authorized for client_credentials grant".to_string(),
            ));
        }

        // Generate access token (no refresh token for client credentials)
        let access_token = Uuid::new_v4().to_string();

        let now = Utc::now();

        let oauth_token = OAuthToken {
            access_token: access_token.clone(),
            refresh_token: None,
            token_type: "Bearer".to_string(),
            expires_in: 3600, // 1 hour
            scope: self.scope.clone().unwrap_or_default(),
            client_id: self.client_id.clone(),
            user_id: self.client_id.clone(), // Use client_id as user_id for client credentials
            expires_at: now + Duration::seconds(3600),
            is_revoked: false,
            created_at: now,
        };

        // Store token
        repository
            .store_oauth_token(&oauth_token)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to store OAuth token: {}", e))
            })?;

        Ok(TokenResponse {
            access_token,
            token_type: "Bearer".to_string(),
            expires_in: 3600,
            refresh_token: None,
            scope: self.scope.clone(),
        })
    }

    fn validate_pkce(
        &self,
        code_verifier: &str,
        code_challenge: &str,
        method: &Option<String>,
    ) -> bool {
        match method.as_deref() {
            Some("S256") => {
                use base64::{Engine, engine::general_purpose};
                use sha2::{Digest, Sha256};
                let mut hasher = Sha256::new();
                hasher.update(code_verifier.as_bytes());
                let hash = hasher.finalize();
                let encoded = general_purpose::URL_SAFE_NO_PAD.encode(hash);
                encoded == code_challenge
            }
            Some("plain") | None => code_verifier == code_challenge,
            _ => false,
        }
    }
}

#[derive(Deserialize)]
pub struct IntrospectTokenRequest {
    pub token: String,
    pub token_type_hint: Option<String>,
    pub client_id: String,
    pub client_secret: Option<String>,
}

#[derive(Serialize)]
pub struct IntrospectTokenResponse {
    pub active: bool,
    pub scope: Option<String>,
    pub client_id: Option<String>,
    pub username: Option<String>,
    pub token_type: Option<String>,
    pub exp: Option<u64>,
    pub iat: Option<u64>,
    pub nbf: Option<u64>,
    pub sub: Option<String>,
    pub aud: Option<String>,
    pub iss: Option<String>,
    pub jti: Option<String>,
}

impl IntrospectTokenRequest {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<IntrospectTokenResponse, ApplicationError> {
        Span::current().set_attribute("oauth.client_id", self.client_id.clone());

        // Validate client
        if let Some(client_secret) = &self.client_secret
            && !repository
                .validate_client_secret(&self.client_id, client_secret)
                .await
                .map_err(|e| {
                    ApplicationError::InternalError(format!(
                        "Failed to validate client secret: {}",
                        e
                    ))
                })?
        {
            return Err(ApplicationError::InvalidInput(
                "Invalid client credentials".to_string(),
            ));
        }

        // Get token
        let oauth_token = repository.get_oauth_token(&self.token).await.map_err(|e| {
            ApplicationError::InternalError(format!("Failed to get OAuth token: {}", e))
        })?;

        match oauth_token {
            Some(token) => {
                // Check if token is still valid
                let now = Utc::now();
                let active = token.expires_at > now && !token.is_revoked;

                Span::current().set_attribute("user.id", token.user_id.clone());

                Ok(IntrospectTokenResponse {
                    active,
                    scope: Some(token.scope),
                    client_id: Some(token.client_id.clone()),
                    username: Some(token.user_id.clone()),
                    token_type: Some(token.token_type),
                    exp: Some(token.expires_at.timestamp() as u64),
                    iat: Some(token.created_at.timestamp() as u64),
                    nbf: Some(token.created_at.timestamp() as u64),
                    sub: Some(token.user_id),
                    aud: Some(token.client_id),
                    iss: Some("user-management-service".to_string()),
                    jti: Some(token.access_token),
                })
            }
            None => Ok(IntrospectTokenResponse {
                active: false,
                scope: None,
                client_id: None,
                username: None,
                token_type: None,
                exp: None,
                iat: None,
                nbf: None,
                sub: None,
                aud: None,
                iss: None,
                jti: None,
            }),
        }
    }
}

#[derive(Deserialize)]
pub struct RevokeTokenRequest {
    pub token: String,
    pub token_type_hint: Option<String>,
    pub client_id: String,
    pub client_secret: Option<String>,
}

impl RevokeTokenRequest {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<(), ApplicationError> {
        Span::current().set_attribute("user.id", self.client_id.clone());

        // Validate client
        if let Some(client_secret) = &self.client_secret
            && !repository
                .validate_client_secret(&self.client_id, client_secret)
                .await
                .map_err(|e| {
                    ApplicationError::InternalError(format!(
                        "Failed to validate client secret: {}",
                        e
                    ))
                })?
        {
            return Err(ApplicationError::InvalidInput(
                "Invalid client credentials".to_string(),
            ));
        }

        // Revoke token (both access and refresh tokens)
        repository
            .revoke_oauth_token(&self.token)
            .await
            .map_err(|e| {
                ApplicationError::InternalError(format!("Failed to revoke token: {}", e))
            })?;

        Ok(())
    }
}
