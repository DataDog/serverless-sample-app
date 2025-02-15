use std::time::{SystemTime, UNIX_EPOCH};

use crate::{
    core::{EventPublisher, Repository, RepositoryError, User, UserDTO},
    tokens::TokenGenerator,
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
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
}

#[derive(Deserialize)]
pub struct CreateUserCommand {
    email_address: String,
    first_name: String,
    last_name: String,
    password: String,
}

pub async fn handle_create_user<TRepo: Repository, TEventPublisher: EventPublisher>(
    repository: &TRepo,
    event_publisher: &TEventPublisher,
    create_user_command: CreateUserCommand,
) -> Result<UserDTO, ApplicationError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(create_user_command.password.as_bytes(), &salt)
        .map_err(|_e| ApplicationError::InternalError(_e.to_string()))?
        .to_string();

    let user = User::new(
        create_user_command.email_address,
        create_user_command.first_name,
        create_user_command.last_name,
        hash,
    );

    let _res = repository.update_user_details(&user).await;

    event_publisher
        .publish_user_created_event(user.clone().into())
        .await
        .map_err(|_e| ApplicationError::InternalError("Failure publishing event".to_string()))?;

    Ok(user.as_dto())
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

    user.was_active();

    let _res = repository.update_user_details(&user).await;

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

        user.was_active();

        let _res = repository.update_user_details(&user).await;

        Ok(())
    }
}
