use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RepositoryError {
    #[error("Product not found")]
    NotFound,
    #[error("Error: {0}")]
    InternalError(String),
    #[error("InvalidUserType: {0}")]
    InvalidUserType(String),
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
        details.order_count = details.order_count + 1;

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

    pub(crate) fn email_address(&self) -> &str {
        let details = match self {
            User::Standard(details) => details,
            User::Premium(details) => details,
            User::Admin(details) => details,
        };

        &details.email_address.as_str()
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

#[derive(Serialize)]
pub struct UserCreatedEvent {
    user_id: String,
}

impl From<User> for UserCreatedEvent {
    fn from(value: User) -> Self {
        match value {
            User::Standard(details) => UserCreatedEvent {
                user_id: details.user_id,
            },
            User::Premium(details) => UserCreatedEvent {
                user_id: details.user_id,
            },
            User::Admin(details) => UserCreatedEvent {
                user_id: details.user_id,
            },
        }
    }
}
