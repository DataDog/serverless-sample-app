use std::time::{SystemTime, UNIX_EPOCH};

use jsonwebtoken::{encode, EncodingKey, Header};
use serde::Serialize;

use crate::core::User;

pub struct TokenGenerator {
    secret: String,
    expiration: usize,
}

#[derive(Debug, Serialize)]
struct Claims {
    sub: String, // email address
    user_type: String,
    exp: usize, // expiration time
    iat: usize, // issued at
}

impl TokenGenerator {
    pub fn new(secret: String, expiration: usize) -> Self {
        TokenGenerator {
            secret,
            expiration,
        }
    }

    pub fn generate_token(&self, user: User) -> String {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as usize;

        let claims = Claims {
            sub: user.email_address().to_string(),
            user_type: user.user_type().to_string(),
            exp: now + self.expiration,
            iat: now,
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.secret.as_bytes()),
        )
        .unwrap()
    }
}