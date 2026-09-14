use std::time::{SystemTime, UNIX_EPOCH};

use jsonwebtoken::{DecodingKey, EncodingKey, Header, decode, encode};
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
        tracing::info!("Validating [REDACTED] against {}", hashed_email_address);

        let claim = self.decode_token(token)?;

        claim
            .is_for_user(&hashed_email_address)
            .map_err(|_e| ApplicationError::InvalidToken())?;

        Ok(claim)
    }

    pub fn validate_admin_token(&self, token: &str) -> Result<Claims, ApplicationError> {
        let claim = self.decode_token(token)?;
        if claim.user_type != "ADMIN" {
            return Err(ApplicationError::InvalidToken());
        }
        Ok(claim)
    }

    fn decode_token(&self, token: &str) -> Result<Claims, ApplicationError> {
        let token = token.strip_prefix("Bearer ").unwrap_or(token);
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.secret.as_bytes()),
            &jsonwebtoken::Validation::default(),
        )
        .map(|data| data.claims)
        .map_err(|_e| ApplicationError::InvalidToken())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::{User, UserDetails};
    use chrono::Utc;

    fn make_test_user() -> User {
        User::Standard(UserDetails {
            user_id: "TEST@TEST.COM".to_string(),
            email_address: "test@test.com".to_string(),
            first_name: "Test".to_string(),
            last_name: "User".to_string(),
            password_hash: "hash".to_string(),
            created_at: Utc::now(),
            last_active: None,
            order_count: 0,
        })
    }

    #[test]
    fn test_generate_and_validate_token() {
        let secret = "c2c45e2d-d682-4f44-88ce-e6be0e1da918".to_string();
        let token_generator = TokenGenerator::new(secret, 3600);

        let user = make_test_user();
        let token = token_generator.generate_token(user);

        let res = token_generator.validate_token(&format!("Bearer {}", token), "test@test.com");

        assert!(res.is_ok());
    }

    #[test]
    fn admin_validation_rejects_non_admin_and_accepts_admin() {
        let token_generator = TokenGenerator::new("test-secret".to_string(), 3600);
        let standard_token = token_generator.generate_token(make_test_user());
        assert!(
            token_generator
                .validate_admin_token(&standard_token)
                .is_err()
        );

        let admin = User::Admin(UserDetails {
            user_id: "ADMIN@TEST.COM".to_string(),
            email_address: "admin@test.com".to_string(),
            first_name: "Admin".to_string(),
            last_name: "User".to_string(),
            password_hash: "hash".to_string(),
            created_at: Utc::now(),
            last_active: None,
            order_count: 0,
        });
        let admin_token = token_generator.generate_token(admin);
        assert!(token_generator.validate_admin_token(&admin_token).is_ok());
    }
}
