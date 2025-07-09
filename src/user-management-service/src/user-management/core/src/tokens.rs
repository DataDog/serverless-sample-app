use std::time::{SystemTime, UNIX_EPOCH};

use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header};
use serde::{Deserialize, Serialize};

use crate::core::User;
use crate::ports::ApplicationError;
use crate::utils::StringHasher;

pub struct TokenGenerator {
    secret: String,
    expiration: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    sub: String, // email address
    user_type: String,
    exp: usize, // expiration time
    iat: usize, // issued at
}

impl Claims {
    fn is_for_user(&self, email_address: &str) -> Result<(), ()> {
        if self.sub == email_address {
            Ok(())
        } else {
            Err(())
        }
    }
}

impl TokenGenerator {
    pub fn new(secret: String, expiration: usize) -> Self {
        TokenGenerator { secret, expiration }
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

    pub fn validate_token(
        &self,
        token: &str,
        email_address: &str,
    ) -> Result<Claims, ApplicationError> {
        let hashed_email_address = StringHasher::hash_string(email_address.to_uppercase());
        tracing::info!("Validating {} against {}", token, hashed_email_address);

        let token = if token.contains("Bearer ") {
            let token = token.replace("Bearer ", "");
            token
        } else {
            token.to_string()
        };

        let claim = decode::<Claims>(
            &token,
            &DecodingKey::from_secret(self.secret.as_bytes()),
            &jsonwebtoken::Validation::default(),
        )
        .map(|data| data.claims)
        .map_err(|_e| ApplicationError::InvalidToken())?;

        claim
            .is_for_user(&hashed_email_address)
            .map_err(|_e| ApplicationError::InvalidToken())?;

        Ok(claim)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_token() {
        let token_generator =
            TokenGenerator::new("c2c45e2d-d682-4f44-88ce-e6be0e1da918".to_string(), 3600);

        let res = token_generator.validate_token(
            "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0QHRlc3QuY29tIiwidXNlcl90eXBlIjoiU1RBTkRBUkQiLCJleHAiOjE3Mzk4NzUwMjEsImlhdCI6MTczOTc4ODYyMX0.DAV-VaxuHxrTSqxW-iJmYqswOeASXVnzJa-B7PAIzMc",
            "test@test.com");

        assert!(res.is_ok());
    }
}
