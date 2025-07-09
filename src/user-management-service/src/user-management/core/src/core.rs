use crate::utils::StringHasher;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum RepositoryError {
    #[error("Product not found")]
    NotFound,
    #[error("Error: {0}")]
    InternalError(String),
    #[error("InvalidUserType: {0}")]
    InvalidUserType(String),
    #[error("OAuth client not found")]
    OAuthClientNotFound,
    #[error("Authorization code not found")]
    AuthorizationCodeNotFound,
    #[error("OAuth token not found")]
    OAuthTokenNotFound,
    #[error("Invalid client credentials")]
    InvalidClientCredentials,
    #[error("Authorization code expired")]
    AuthorizationCodeExpired,
    #[error("Authorization code already used")]
    AuthorizationCodeAlreadyUsed,
    #[error("OAuth token expired")]
    OAuthTokenExpired,
    #[error("OAuth token revoked")]
    OAuthTokenRevoked,
}

#[async_trait]
pub trait EventPublisher {
    async fn publish_user_created_event(
        &self,
        user_created_event: UserCreatedEvent,
    ) -> Result<(), ()>;
}

#[async_trait]
pub trait Repository {
    async fn get_user(&self, email_address: &str) -> Result<User, RepositoryError>;

    async fn update_user_details(&self, body: &User) -> Result<(), RepositoryError>;

    // OAuth Client management
    async fn create_oauth_client(&self, client: &OAuthClient) -> Result<(), RepositoryError>;
    async fn get_oauth_client(
        &self,
        client_id: &str,
    ) -> Result<Option<OAuthClient>, RepositoryError>;
    async fn update_oauth_client(&self, client: &OAuthClient) -> Result<(), RepositoryError>;
    async fn delete_oauth_client(&self, client_id: &str) -> Result<(), RepositoryError>;
    async fn list_oauth_clients(
        &self,
        page: Option<u32>,
        limit: Option<u32>,
    ) -> Result<Vec<OAuthClient>, RepositoryError>;
    async fn validate_client_secret(
        &self,
        client_id: &str,
        client_secret: &str,
    ) -> Result<bool, RepositoryError>;

    // Authorization Code management
    async fn store_authorization_code(
        &self,
        code: &AuthorizationCode,
    ) -> Result<(), RepositoryError>;
    async fn get_authorization_code(
        &self,
        code: &str,
    ) -> Result<Option<AuthorizationCode>, RepositoryError>;
    async fn revoke_authorization_code(&self, code: &str) -> Result<(), RepositoryError>;
    async fn mark_authorization_code_used(&self, code: &str) -> Result<(), RepositoryError>;
    async fn cleanup_expired_authorization_codes(&self) -> Result<(), RepositoryError>;

    // OAuth Token management
    async fn store_oauth_token(&self, token: &OAuthToken) -> Result<(), RepositoryError>;
    async fn get_oauth_token(
        &self,
        access_token: &str,
    ) -> Result<Option<OAuthToken>, RepositoryError>;
    async fn get_oauth_token_by_refresh(
        &self,
        refresh_token: &str,
    ) -> Result<Option<OAuthToken>, RepositoryError>;
    async fn revoke_oauth_token(&self, access_token: &str) -> Result<(), RepositoryError>;
    async fn revoke_all_tokens_for_client(&self, client_id: &str) -> Result<(), RepositoryError>;
    async fn cleanup_expired_oauth_tokens(&self) -> Result<(), RepositoryError>;
}

#[derive(Serialize)]
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

#[derive(Clone)]
pub enum User {
    Standard(UserDetails),
    Premium(UserDetails),
    Admin(UserDetails),
}

#[derive(Clone, Serialize)]
pub struct UserDetails {
    pub(crate) user_id: String,
    pub(crate) email_address: String,
    pub(crate) first_name: String,
    pub(crate) last_name: String,
    pub(crate) password_hash: String,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) last_active: Option<DateTime<Utc>>,
    pub(crate) order_count: usize,
}

impl User {
    pub(crate) fn from_details(
        user_details: UserDetails,
        user_type: &str,
    ) -> Result<Self, RepositoryError> {
        //TODO: Update use of magic strings
        match user_type {
            "STANDARD" => Ok(User::Standard(user_details)),
            "PREMIUM" => Ok(User::Premium(user_details)),
            "ADMIN" => Ok(User::Admin(user_details)),
            _ => Err(RepositoryError::InvalidUserType(user_type.to_string())),
        }
    }

    pub(crate) fn new(
        email_address: String,
        first_name: String,
        last_name: String,
        password_hash: String,
    ) -> Self {
        Self::Standard(UserDetails {
            user_id: email_address.to_uppercase(),
            email_address,
            first_name,
            last_name,
            password_hash,
            created_at: Utc::now(),
            last_active: Option::Some(Utc::now()),
            order_count: 0,
        })
    }

    pub(crate) fn new_admin(
        email_address: String,
        first_name: String,
        last_name: String,
        password_hash: String,
    ) -> Self {
        Self::Admin(UserDetails {
            user_id: email_address.to_uppercase(),
            email_address,
            first_name,
            last_name,
            password_hash,
            created_at: Utc::now(),
            last_active: Option::Some(Utc::now()),
            order_count: 0,
        })
    }

    pub(crate) fn order_placed(&mut self) {
        let details = match self {
            User::Standard(details) => details,
            User::Premium(details) => details,
            User::Admin(details) => details,
        };

        details.last_active = Option::Some(Utc::now());
        details.order_count += 1;

        if details.order_count > 10 {
            *self = User::Premium(details.clone());
        }
    }

    pub(crate) fn get_password_hash(&self) -> &str {
        let details = match self {
            User::Standard(details) => details,
            User::Premium(details) => details,
            User::Admin(details) => details,
        };

        details.password_hash.as_str()
    }

    pub(crate) fn email_address(&self) -> String {
        let details = match self {
            User::Standard(details) => details,
            User::Premium(details) => details,
            User::Admin(details) => details,
        };

        

        StringHasher::hash_string(details.email_address.to_uppercase())
    }

    pub(crate) fn user_type(&self) -> &str {
        match self {
            User::Standard(_) => "STANDARD",
            User::Premium(_) => "PREMIUM",
            User::Admin(_) => "ADMIN",
        }
    }

    pub(crate) fn as_dto(&self) -> UserDTO {
        let details = match self {
            User::Standard(details) => details,
            User::Premium(details) => details,
            User::Admin(details) => details,
        };

        UserDTO {
            user_id: details.user_id.clone(),
            email_address: details.email_address.clone(),
            first_name: details.first_name.clone(),
            last_name: details.last_name.clone(),
            order_count: details.order_count,
        }
    }
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserCreatedEvent {
    user_id: String,
}

impl From<User> for UserCreatedEvent {
    fn from(value: User) -> Self {
        UserCreatedEvent {
            user_id: value.email_address().to_string(),
        }
    }
}

// OAuth Domain Models

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OAuthClient {
    pub client_id: String,
    pub client_secret: String,
    pub client_name: String,
    pub redirect_uris: Vec<String>,
    pub grant_types: Vec<GrantType>,
    pub response_types: Vec<ResponseType>,
    pub scopes: Vec<String>,
    pub token_endpoint_auth_method: TokenEndpointAuthMethod,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_active: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum GrantType {
    AuthorizationCode,
    ClientCredentials,
    RefreshToken,
    Implicit,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum ResponseType {
    Code,
    Token,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum TokenEndpointAuthMethod {
    ClientSecretBasic,
    ClientSecretPost,
    None,
}

impl OAuthClient {
    pub fn new(
        client_name: String,
        redirect_uris: Vec<String>,
        grant_types: Vec<GrantType>,
        scopes: Vec<String>,
        token_endpoint_auth_method: TokenEndpointAuthMethod,
    ) -> Self {
        let client_id = format!("client_{}", Uuid::new_v4().to_string().replace('-', ""));
        let client_secret = Uuid::new_v4().to_string();
        let now = Utc::now();

        Self {
            client_id,
            client_secret,
            client_name,
            redirect_uris,
            grant_types,
            response_types: vec![ResponseType::Code],
            scopes,
            token_endpoint_auth_method,
            created_at: now,
            updated_at: now,
            is_active: true,
        }
    }

    pub fn update(
        &mut self,
        client_name: Option<String>,
        redirect_uris: Option<Vec<String>>,
        scopes: Option<Vec<String>>,
    ) {
        if let Some(name) = client_name {
            self.client_name = name;
        }
        if let Some(uris) = redirect_uris {
            self.redirect_uris = uris;
        }
        if let Some(scopes) = scopes {
            self.scopes = scopes;
        }
        self.updated_at = Utc::now();
    }

    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    pub fn as_dto(&self) -> OAuthClientDTO {
        OAuthClientDTO {
            client_id: self.client_id.clone(),
            client_name: self.client_name.clone(),
            redirect_uris: self.redirect_uris.clone(),
            grant_types: self
                .grant_types
                .iter()
                .map(|g| format!("{:?}", g))
                .collect(),
            scopes: self.scopes.clone(),
            token_endpoint_auth_method: format!("{:?}", self.token_endpoint_auth_method),
            created_at: self.created_at,
            updated_at: self.updated_at,
            is_active: self.is_active,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthorizationCode {
    pub code: String,
    pub client_id: String,
    pub user_id: String,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub is_used: bool,
}

impl AuthorizationCode {
    pub fn new(
        client_id: String,
        user_id: String,
        redirect_uri: String,
        scopes: Vec<String>,
        code_challenge: Option<String>,
        code_challenge_method: Option<String>,
    ) -> Self {
        let code = format!("auth_{}", Uuid::new_v4().to_string().replace('-', ""));
        let now = Utc::now();
        let expires_at = now + chrono::Duration::minutes(10);

        Self {
            code,
            client_id,
            user_id,
            redirect_uri,
            scopes,
            code_challenge,
            code_challenge_method,
            expires_at,
            created_at: now,
            is_used: false,
        }
    }

    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    pub fn mark_as_used(&mut self) {
        self.is_used = true;
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OAuthToken {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub refresh_token: Option<String>,
    pub scope: String,
    pub client_id: String,
    pub user_id: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub is_revoked: bool,
}

impl OAuthToken {
    pub fn new(client_id: String, user_id: String, scopes: Vec<String>, expires_in: i64) -> Self {
        let access_token = format!("token_{}", Uuid::new_v4().to_string().replace('-', ""));
        let refresh_token = Some(format!(
            "refresh_{}",
            Uuid::new_v4().to_string().replace('-', "")
        ));
        let now = Utc::now();
        let expires_at = now + chrono::Duration::seconds(expires_in);

        Self {
            access_token,
            token_type: "Bearer".to_string(),
            expires_in,
            refresh_token,
            scope: scopes.join(" "),
            client_id,
            user_id,
            created_at: now,
            expires_at,
            is_revoked: false,
        }
    }

    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    pub fn revoke(&mut self) {
        self.is_revoked = true;
    }

    pub fn as_dto(&self) -> OAuthTokenDTO {
        OAuthTokenDTO {
            access_token: self.access_token.clone(),
            token_type: self.token_type.clone(),
            expires_in: self.expires_in,
            refresh_token: self.refresh_token.clone(),
            scope: self.scope.clone(),
        }
    }
}

// DTOs for API responses

#[derive(Serialize)]
pub struct OAuthClientDTO {
    #[serde(rename = "clientId")]
    pub client_id: String,
    #[serde(rename = "clientName")]
    pub client_name: String,
    #[serde(rename = "redirectUris")]
    pub redirect_uris: Vec<String>,
    #[serde(rename = "grantTypes")]
    pub grant_types: Vec<String>,
    pub scopes: Vec<String>,
    #[serde(rename = "tokenEndpointAuthMethod")]
    pub token_endpoint_auth_method: String,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
    #[serde(rename = "isActive")]
    pub is_active: bool,
}

#[derive(Serialize)]
pub struct OAuthTokenDTO {
    #[serde(rename = "access_token")]
    pub access_token: String,
    #[serde(rename = "token_type")]
    pub token_type: String,
    #[serde(rename = "expires_in")]
    pub expires_in: i64,
    #[serde(rename = "refresh_token")]
    pub refresh_token: Option<String>,
    pub scope: String,
}

#[derive(Serialize)]
pub struct OAuthClientCreatedDTO {
    #[serde(rename = "clientId")]
    pub client_id: String,
    #[serde(rename = "clientSecret")]
    pub client_secret: String,
    #[serde(rename = "clientName")]
    pub client_name: String,
    #[serde(rename = "redirectUris")]
    pub redirect_uris: Vec<String>,
    #[serde(rename = "grantTypes")]
    pub grant_types: Vec<String>,
    pub scopes: Vec<String>,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}
