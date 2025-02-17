use std::time::{SystemTime, UNIX_EPOCH};

use crate::{
    core::{EventPublisher, Repository, RepositoryError, User, UserDTO},
    tokens::TokenGenerator,
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use aws_sdk_sns::config::BehaviorVersion;
use jsonwebtoken::{encode, EncodingKey, Header};
use rand::Rng;
use serde::{Deserialize, Serialize};
use thiserror::Error;

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
        GetUserDetailsQuery {
            email_address
        }
    }
    
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<UserDTO, ApplicationError> {
        let res = repository.get_user(&self.email_address).await;

        match res {
            Ok(user) => Ok(user.as_dto()),
            Err(e) => match e {
                RepositoryError::NotFound => Err(ApplicationError::NotFound),
                RepositoryError::InternalError(e) => Err(ApplicationError::InternalError(e.to_string())),
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
    pub fn new(email_address: String, first_name: String, last_name: String, password: String) -> Self {
        CreateUserCommand {
            email_address,
            first_name,
            last_name,
            password,
            admin_user: None
        }
    }
    pub fn new_admin_user(email_address: String, first_name: String, last_name: String, password: String) -> Self {
        CreateUserCommand {
            email_address,
            first_name,
            last_name,
            password,
            admin_user: Some(true)
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
            .hash_password(&self.password.as_bytes(), &salt)
            .map_err(|_e| ApplicationError::InternalError(_e.to_string()))?
            .to_string();

        let mut user = match &self.admin_user {
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
            )
        };

        let _res = repository.update_user_details(&user).await;

        event_publisher
            .publish_user_created_event(user.clone().into())
            .await
            .map_err(|_e| ApplicationError::InternalError("Failure publishing event".to_string()))?;

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
    let mut user = repository
        .get_user(&login_command.email_address)
        .await
        .map_err(|e| {
            return match e {
                RepositoryError::NotFound => ApplicationError::NotFound,
                RepositoryError::InternalError(e) => ApplicationError::InternalError(e.to_string()),
                _ => ApplicationError::InternalError(e.to_string()),
            };
        })?;

    let parsed_hash = PasswordHash::new(&user.get_password_hash())
        .map_err(|_e| ApplicationError::InternalError(_e.to_string()))?;
    let _verified_password = Argon2::default()
        .verify_password(login_command.password.as_bytes(), &parsed_hash)
        .map_err(|_e| ApplicationError::InvalidPassword())?;

    let token = token_generator.generate_token(user);

    Ok(LoginResponse { token })
}

#[derive(Serialize, Deserialize)]
pub struct OrderCompleted {
    email_address: String,
}

impl OrderCompleted {
    pub async fn handle<TRepo: Repository>(
        &self,
        repository: &TRepo,
    ) -> Result<(), ApplicationError> {
        let mut user = repository
            .get_user(&self.email_address)
            .await
            .map_err(|e| {
                return match e {
                    RepositoryError::NotFound => ApplicationError::NotFound,
                    RepositoryError::InternalError(e) => {
                        ApplicationError::InternalError(e.to_string())
                    }
                    _ => ApplicationError::InternalError(e.to_string()),
                };
            })?;

        user.order_placed();

        let _res = repository.update_user_details(&user).await;

        Ok(())
    }
}
