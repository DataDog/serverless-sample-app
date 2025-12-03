use crate::core::{
    AuthorizationCode, EventPublisher, GrantType, OAuthClient, OAuthToken, Repository,
    RepositoryError, ResponseType, TokenEndpointAuthMethod, User, UserCreatedEvent, UserDetails,
};
use crate::utils::StringHasher;
use async_trait::async_trait;
use aws_sdk_dynamodb::Client;
use aws_sdk_dynamodb::error::SdkError;
use aws_sdk_dynamodb::operation::put_item::PutItemError;
use aws_sdk_dynamodb::types::AttributeValue;
use observability::CloudEvent;
use tracing::{Span, instrument};
use tracing_opentelemetry::OpenTelemetrySpanExt;

pub struct DynamoDbRepository {
    client: Client,
    table_name: String,
}

const PARTITION_KEY: &str = "PK";
const SORT_KEY: &str = "SK";
const FIRST_NAME_KEY: &str = "FirstName";
const LAST_NAME_KEY: &str = "LastName";
const EMAIL_ADDRESS_KEY: &str = "EmailAddress";
const USER_ID_KEY: &str = "UserId";
const PASSWORD_HASH_KEY: &str = "PasswordHash";
const USER_TYPE_KEY: &str = "UserType";
const CREATED_AT_KEY: &str = "CreatedAt";
const LAST_ACTIVE_KEY: &str = "LastActive";

const ORDER_COUNT_KEY: &str = "OrderCount";

impl DynamoDbRepository {
    pub fn new(client: Client, table_name: String) -> DynamoDbRepository {
        DynamoDbRepository { client, table_name }
    }

    async fn put_to_dynamo(&self, user: &User) -> Result<(), RepositoryError> {
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.PutItem {}", &self.table_name),
        );

        tracing::info!("Storing user details in DynamoDB");

        let details = match user {
            User::Standard(details) => details,
            User::Premium(details) => details,
            User::Admin(details) => details,
        };

        tracing::info!("Sending put item request");

        let put_item_builder = self
            .client
            .put_item()
            .table_name(&self.table_name)
            .item(PARTITION_KEY, AttributeValue::S(user.email_address()))
            .item(SORT_KEY, AttributeValue::S(user.email_address()))
            .item(
                FIRST_NAME_KEY,
                AttributeValue::S(details.first_name.clone()),
            )
            .item(LAST_NAME_KEY, AttributeValue::S(details.last_name.clone()))
            .item(
                EMAIL_ADDRESS_KEY,
                AttributeValue::S(details.email_address.clone()),
            )
            .item(USER_ID_KEY, AttributeValue::S(details.user_id.clone()))
            .item(
                PASSWORD_HASH_KEY,
                AttributeValue::S(details.password_hash.clone()),
            )
            .item(
                USER_TYPE_KEY,
                AttributeValue::S(user.user_type().to_string()),
            )
            .item(
                CREATED_AT_KEY,
                AttributeValue::S(details.created_at.to_string()),
            )
            .item(
                ORDER_COUNT_KEY,
                AttributeValue::N(details.order_count.to_string()),
            );

        let res = if details.last_active.is_some() {
            put_item_builder.clone().item(
                LAST_ACTIVE_KEY,
                AttributeValue::S(details.last_active.unwrap().to_string()),
            );

            put_item_builder.send().await
        } else {
            put_item_builder.send().await
        };

        match res {
            Ok(_) => Ok(()),
            Err(e) => {
                let error_message = match e {
                    SdkError::ConstructionFailure(_) => "construction failure",
                    SdkError::TimeoutError(_) => "timeout error",
                    SdkError::DispatchFailure(_) => "dispatch failure",
                    SdkError::ResponseError(_) => "response error",
                    SdkError::ServiceError(e) => match e.err() {
                        PutItemError::ConditionalCheckFailedException(_) => {
                            "conditional check failed"
                        }
                        PutItemError::InternalServerError(_) => "DynamoDB internal server error",
                        PutItemError::InvalidEndpointException(_) => "invalid endpoint",
                        PutItemError::ItemCollectionSizeLimitExceededException(_) => {
                            "item collection size limit exceeded"
                        }
                        PutItemError::ProvisionedThroughputExceededException(_) => {
                            "provisioned throughput exceeded"
                        }
                        PutItemError::ReplicatedWriteConflictException(_) => {
                            "replicated write conflict"
                        }
                        PutItemError::RequestLimitExceeded(_) => "request limit exceeded",
                        PutItemError::ResourceNotFoundException(_) => "resource not found",
                        PutItemError::TransactionConflictException(_) => "transaction conflict",
                        _ => "unknown error",
                    },
                    _ => "unknown error",
                };

                tracing::error!("Error storing user details in DynamoDB: {}", error_message);

                Err(RepositoryError::InternalError(error_message.to_string()))
            }
        }
    }
}

#[async_trait]
impl Repository for DynamoDbRepository {
    #[instrument(name = "get_user", skip(self, email_address))]
    async fn get_user(&self, email_address: &str) -> Result<User, RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.GetItem {}", &self.table_name),
        );

        let search_address = StringHasher::hash_string(email_address.to_uppercase());

        let res = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key(PARTITION_KEY, AttributeValue::S(search_address.clone()))
            .key(SORT_KEY, AttributeValue::S(search_address))
            .send()
            .await;

        match res {
            Ok(item) => Ok({
                if item.item.is_none() {
                    Span::current().set_attribute("login.status", "user_not_found");
                    return Err(RepositoryError::NotFound);
                }

                let attributes = item.item().unwrap().clone();

                let user_details = UserDetails {
                    email_address: attributes
                        .get(EMAIL_ADDRESS_KEY)
                        .unwrap()
                        .as_s()
                        .unwrap()
                        .clone(),
                    first_name: attributes
                        .get(FIRST_NAME_KEY)
                        .unwrap()
                        .as_s()
                        .unwrap()
                        .clone(),
                    last_name: attributes
                        .get(LAST_NAME_KEY)
                        .unwrap()
                        .as_s()
                        .unwrap()
                        .clone(),
                    user_id: attributes.get(USER_ID_KEY).unwrap().as_s().unwrap().clone(),
                    password_hash: attributes
                        .get(PASSWORD_HASH_KEY)
                        .unwrap()
                        .as_s()
                        .unwrap()
                        .clone(),
                    created_at: attributes
                        .get(CREATED_AT_KEY)
                        .unwrap()
                        .as_s()
                        .unwrap()
                        .parse()
                        .unwrap(),
                    last_active: attributes
                        .get(LAST_ACTIVE_KEY)
                        .map(|value| value.as_s().unwrap().parse().unwrap()),
                    order_count: attributes
                        .get(ORDER_COUNT_KEY)
                        .unwrap()
                        .as_n()
                        .unwrap()
                        .parse()
                        .unwrap(),
                };

                User::from_details(
                    user_details,
                    &attributes
                        .get(USER_TYPE_KEY)
                        .unwrap()
                        .as_s()
                        .unwrap()
                        .clone(),
                )?
            }),
            Err(_e) => Err(RepositoryError::NotFound),
        }
    }

    #[instrument(name = "update_user_details", skip(self, body))]
    async fn update_user_details(&self, body: &User) -> Result<(), RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        self.put_to_dynamo(body).await
    }

    // OAuth Client management
    #[instrument(name = "create_oauth_client", skip(self, client))]
    async fn create_oauth_client(&self, client: &OAuthClient) -> Result<(), RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.PutItem {}", &self.table_name),
        );

        let res = self
            .client
            .put_item()
            .table_name(&self.table_name)
            .item(
                PARTITION_KEY,
                AttributeValue::S(format!("CLIENT#{}", client.client_id)),
            )
            .item(SORT_KEY, AttributeValue::S("METADATA".to_string()))
            .item("ClientId", AttributeValue::S(client.client_id.clone()))
            .item(
                "ClientSecret",
                AttributeValue::S(client.client_secret.clone()),
            )
            .item("ClientName", AttributeValue::S(client.client_name.clone()))
            .item(
                "RedirectUris",
                AttributeValue::Ss(client.redirect_uris.clone()),
            )
            .item(
                "GrantTypes",
                AttributeValue::Ss(
                    client
                        .grant_types
                        .iter()
                        .map(|g| format!("{:?}", g))
                        .collect(),
                ),
            )
            .item(
                "ResponseTypes",
                AttributeValue::Ss(
                    client
                        .response_types
                        .iter()
                        .map(|r| format!("{:?}", r))
                        .collect(),
                ),
            )
            .item("Scopes", AttributeValue::Ss(client.scopes.clone()))
            .item(
                "TokenEndpointAuthMethod",
                AttributeValue::S(format!("{:?}", client.token_endpoint_auth_method)),
            )
            .item(
                "CreatedAt",
                AttributeValue::S(client.created_at.to_rfc3339()),
            )
            .item(
                "UpdatedAt",
                AttributeValue::S(client.updated_at.to_rfc3339()),
            )
            .item("IsActive", AttributeValue::Bool(client.is_active))
            .send()
            .await;

        match res {
            Ok(_) => Ok(()),
            Err(e) => {
                tracing::error!("Error creating OAuth client: {:?}", e);
                Err(RepositoryError::InternalError(
                    "Failed to create OAuth client".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "get_oauth_client", skip(self))]
    async fn get_oauth_client(
        &self,
        client_id: &str,
    ) -> Result<Option<OAuthClient>, RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.GetItem {}", &self.table_name),
        );

        let res = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key(
                PARTITION_KEY,
                AttributeValue::S(format!("CLIENT#{}", client_id)),
            )
            .key(SORT_KEY, AttributeValue::S("METADATA".to_string()))
            .send()
            .await;

        match res {
            Ok(result) => {
                if let Some(item) = result.item {
                    Ok(Some(self.dynamo_item_to_oauth_client(item)?))
                } else {
                    Ok(None)
                }
            }
            Err(e) => {
                tracing::error!("Error getting OAuth client: {:?}", e);
                Span::current().record("error.message", format!("{:?}", e));
                Err(RepositoryError::InternalError(
                    "Failed to get OAuth client".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "update_oauth_client", skip(self, client))]
    async fn update_oauth_client(&self, client: &OAuthClient) -> Result<(), RepositoryError> {
        self.create_oauth_client(client).await
    }

    #[instrument(name = "delete_oauth_client", skip(self, client_id))]
    async fn delete_oauth_client(&self, client_id: &str) -> Result<(), RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.DeleteItem {}", &self.table_name),
        );

        let res = self
            .client
            .delete_item()
            .table_name(&self.table_name)
            .key(
                PARTITION_KEY,
                AttributeValue::S(format!("CLIENT#{}", client_id)),
            )
            .key(SORT_KEY, AttributeValue::S("METADATA".to_string()))
            .send()
            .await;

        match res {
            Ok(_) => Ok(()),
            Err(e) => {
                tracing::error!("Error deleting OAuth client: {:?}", e);
                Err(RepositoryError::InternalError(
                    "Failed to delete OAuth client".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "list_oauth_clients", skip(self, limit))]
    async fn list_oauth_clients(
        &self,
        _: Option<u32>,
        limit: Option<u32>,
    ) -> Result<Vec<OAuthClient>, RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.Query {}", &self.table_name),
        );

        let page_size = limit.unwrap_or(10) as i32;

        let res = self
            .client
            .scan()
            .table_name(&self.table_name)
            .filter_expression("begins_with(PK, :pk)")
            .expression_attribute_values(":pk", AttributeValue::S("CLIENT#".to_string()))
            .limit(page_size)
            .send()
            .await;

        match res {
            Ok(result) => {
                let mut clients = Vec::new();
                if let Some(items) = result.items {
                    for item in items {
                        if let Ok(client) = self.dynamo_item_to_oauth_client(item) {
                            clients.push(client);
                        }
                    }
                }
                Ok(clients)
            }
            Err(e) => {
                tracing::error!("Error listing OAuth clients: {:?}", e);
                Err(RepositoryError::InternalError(
                    "Failed to list OAuth clients".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "validate_client_secret", skip(self, client_id, client_secret))]
    async fn validate_client_secret(
        &self,
        client_id: &str,
        client_secret: &str,
    ) -> Result<bool, RepositoryError> {
        if let Some(client) = self.get_oauth_client(client_id).await? {
            Ok(client.client_secret == client_secret)
        } else {
            Ok(false)
        }
    }

    // Authorization Code management
    #[instrument(name = "store_authorization_code", skip(self, code))]
    async fn store_authorization_code(
        &self,
        code: &AuthorizationCode,
    ) -> Result<(), RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.PutItem {}", &self.table_name),
        );

        let mut item_builder = self
            .client
            .put_item()
            .table_name(&self.table_name)
            .item(
                PARTITION_KEY,
                AttributeValue::S(format!("CODE#{}", code.code)),
            )
            .item(SORT_KEY, AttributeValue::S("METADATA".to_string()))
            .item("Code", AttributeValue::S(code.code.clone()))
            .item("ClientId", AttributeValue::S(code.client_id.clone()))
            .item("UserId", AttributeValue::S(code.user_id.clone()))
            .item("RedirectUri", AttributeValue::S(code.redirect_uri.clone()))
            .item("Scopes", AttributeValue::Ss(code.scopes.clone()))
            .item("ExpiresAt", AttributeValue::S(code.expires_at.to_rfc3339()))
            .item("CreatedAt", AttributeValue::S(code.created_at.to_rfc3339()))
            .item("IsUsed", AttributeValue::Bool(code.is_used))
            .item(
                "TTL",
                AttributeValue::N(code.expires_at.timestamp().to_string()),
            );

        if let Some(ref challenge) = code.code_challenge {
            item_builder = item_builder.item("CodeChallenge", AttributeValue::S(challenge.clone()));
        }

        if let Some(ref method) = code.code_challenge_method {
            item_builder =
                item_builder.item("CodeChallengeMethod", AttributeValue::S(method.clone()));
        }

        let res = item_builder.send().await;

        match res {
            Ok(_) => Ok(()),
            Err(e) => {
                tracing::error!("Error storing authorization code: {:?}", e);
                Err(RepositoryError::InternalError(
                    "Failed to store authorization code".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "get_authorization_code", skip(self, code))]
    async fn get_authorization_code(
        &self,
        code: &str,
    ) -> Result<Option<AuthorizationCode>, RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.GetItem {}", &self.table_name),
        );

        let res = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key(PARTITION_KEY, AttributeValue::S(format!("CODE#{}", code)))
            .key(SORT_KEY, AttributeValue::S("METADATA".to_string()))
            .send()
            .await;

        match res {
            Ok(result) => {
                if let Some(item) = result.item {
                    Ok(Some(self.dynamo_item_to_authorization_code(item)?))
                } else {
                    Ok(None)
                }
            }
            Err(e) => {
                tracing::error!("Error getting authorization code: {:?}", e);
                Err(RepositoryError::InternalError(
                    "Failed to get authorization code".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "revoke_authorization_code", skip(self, code))]
    async fn revoke_authorization_code(&self, code: &str) -> Result<(), RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.DeleteItem {}", &self.table_name),
        );

        let res = self
            .client
            .delete_item()
            .table_name(&self.table_name)
            .key(PARTITION_KEY, AttributeValue::S(format!("CODE#{}", code)))
            .key(SORT_KEY, AttributeValue::S(format!("CODE#{}", code)))
            .send()
            .await;

        match res {
            Ok(_) => Ok(()),
            Err(e) => {
                tracing::error!("Error revoking authorization code: {:?}", e);
                Err(RepositoryError::InternalError(
                    "Failed to revoke authorization code".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "mark_authorization_code_used", skip(self, code))]
    async fn mark_authorization_code_used(&self, code: &str) -> Result<(), RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.UpdateItem {}", &self.table_name),
        );

        let res = self
            .client
            .update_item()
            .table_name(&self.table_name)
            .key(PARTITION_KEY, AttributeValue::S(format!("CODE#{}", code)))
            .key(SORT_KEY, AttributeValue::S("METADATA".to_string()))
            .update_expression("SET IsUsed = :used")
            .expression_attribute_values(":used", AttributeValue::Bool(true))
            .send()
            .await;

        match res {
            Ok(_) => Ok(()),
            Err(e) => {
                tracing::error!("Error marking authorization code as used: {:?}", e);
                Err(RepositoryError::InternalError(
                    "Failed to mark authorization code as used".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "cleanup_expired_authorization_codes", skip(self))]
    async fn cleanup_expired_authorization_codes(&self) -> Result<(), RepositoryError> {
        // DynamoDB TTL will handle cleanup automatically
        Ok(())
    }

    // OAuth Token management
    #[instrument(name = "store_oauth_token", skip(self, token))]
    async fn store_oauth_token(&self, token: &OAuthToken) -> Result<(), RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.PutItem {}", &self.table_name),
        );

        let mut item_builder = self
            .client
            .put_item()
            .table_name(&self.table_name)
            .item(
                PARTITION_KEY,
                AttributeValue::S(format!("TOKEN#{}", token.access_token)),
            )
            .item(SORT_KEY, AttributeValue::S("METADATA".to_string()))
            .item("AccessToken", AttributeValue::S(token.access_token.clone()))
            .item("TokenType", AttributeValue::S(token.token_type.clone()))
            .item("ExpiresIn", AttributeValue::N(token.expires_in.to_string()))
            .item("Scope", AttributeValue::S(token.scope.clone()))
            .item("ClientId", AttributeValue::S(token.client_id.clone()))
            .item("UserId", AttributeValue::S(token.user_id.clone()))
            .item(
                "CreatedAt",
                AttributeValue::S(token.created_at.to_rfc3339()),
            )
            .item(
                "ExpiresAt",
                AttributeValue::S(token.expires_at.to_rfc3339()),
            )
            .item("IsRevoked", AttributeValue::Bool(token.is_revoked))
            .item(
                "TTL",
                AttributeValue::N(token.expires_at.timestamp().to_string()),
            );

        if let Some(ref refresh_token) = token.refresh_token {
            item_builder =
                item_builder.item("RefreshToken", AttributeValue::S(refresh_token.clone()));
        }

        let res = item_builder.send().await;

        match res {
            Ok(_) => Ok(()),
            Err(e) => {
                tracing::error!("Error storing OAuth token: {:?}", e);
                Err(RepositoryError::InternalError(
                    "Failed to store OAuth token".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "get_oauth_token", skip(self, access_token))]
    async fn get_oauth_token(
        &self,
        access_token: &str,
    ) -> Result<Option<OAuthToken>, RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.GetItem {}", &self.table_name),
        );

        let res = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key(
                PARTITION_KEY,
                AttributeValue::S(format!("TOKEN#{}", access_token)),
            )
            .key(SORT_KEY, AttributeValue::S("METADATA".to_string()))
            .send()
            .await;

        match res {
            Ok(result) => {
                if let Some(item) = result.item {
                    Ok(Some(self.dynamo_item_to_oauth_token(item)?))
                } else {
                    Ok(None)
                }
            }
            Err(e) => {
                tracing::error!("Error getting OAuth token: {:?}", e);
                Err(RepositoryError::InternalError(
                    "Failed to get OAuth token".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "get_oauth_token_by_refresh", skip(self, refresh_token))]
    async fn get_oauth_token_by_refresh(
        &self,
        refresh_token: &str,
    ) -> Result<Option<OAuthToken>, RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.Scan {}", &self.table_name),
        );

        // Note: This is a simplified implementation. In production, you'd want to create a GSI for refresh tokens
        let res = self
            .client
            .scan()
            .table_name(&self.table_name)
            .filter_expression("RefreshToken = :refresh_token")
            .expression_attribute_values(
                ":refresh_token",
                AttributeValue::S(refresh_token.to_string()),
            )
            .send()
            .await;

        match res {
            Ok(result) => {
                if let Some(items) = result.items {
                    if let Some(item) = items.first() {
                        Ok(Some(self.dynamo_item_to_oauth_token(item.clone())?))
                    } else {
                        Ok(None)
                    }
                } else {
                    Ok(None)
                }
            }
            Err(e) => {
                tracing::error!("Error getting OAuth token by refresh: {:?}", e);
                Err(RepositoryError::InternalError(
                    "Failed to get OAuth token by refresh".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "revoke_oauth_token", skip(self, access_token))]
    async fn revoke_oauth_token(&self, access_token: &str) -> Result<(), RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.UpdateItem {}", &self.table_name),
        );

        let res = self
            .client
            .update_item()
            .table_name(&self.table_name)
            .key(
                PARTITION_KEY,
                AttributeValue::S(format!("TOKEN#{}", access_token)),
            )
            .key(SORT_KEY, AttributeValue::S("METADATA".to_string()))
            .update_expression("SET IsRevoked = :revoked")
            .expression_attribute_values(":revoked", AttributeValue::Bool(true))
            .send()
            .await;

        match res {
            Ok(_) => Ok(()),
            Err(e) => {
                tracing::error!("Error revoking OAuth token: {:?}", e);
                Err(RepositoryError::InternalError(
                    "Failed to revoke OAuth token".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "revoke_all_tokens_for_client", skip(self, client_id))]
    async fn revoke_all_tokens_for_client(&self, client_id: &str) -> Result<(), RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        Span::current().set_attribute(
            "resource.name",
            format!("DynamoDB.Scan {}", &self.table_name),
        );

        let res = self
            .client
            .scan()
            .table_name(&self.table_name)
            .filter_expression("begins_with(PK, :pk) AND ClientId = :client_id")
            .expression_attribute_values(":pk", AttributeValue::S("TOKEN#".to_string()))
            .expression_attribute_values(":client_id", AttributeValue::S(client_id.to_string()))
            .send()
            .await;

        match res {
            Ok(result) => {
                if let Some(items) = result.items {
                    for item in items {
                        if let Some(access_token) = item.get("AccessToken")
                            && let Ok(token) = access_token.as_s()
                        {
                            let _ = self.revoke_oauth_token(token).await;
                        }
                    }
                }
                Ok(())
            }
            Err(e) => {
                tracing::error!("Error revoking all tokens for client: {:?}", e);
                Err(RepositoryError::InternalError(
                    "Failed to revoke all tokens for client".to_string(),
                ))
            }
        }
    }

    #[instrument(name = "cleanup_expired_oauth_tokens", skip(self))]
    async fn cleanup_expired_oauth_tokens(&self) -> Result<(), RepositoryError> {
        // DynamoDB TTL will handle cleanup automatically
        Ok(())
    }
}

impl DynamoDbRepository {
    // Helper methods for converting DynamoDB items to domain objects
    fn dynamo_item_to_oauth_client(
        &self,
        item: std::collections::HashMap<String, AttributeValue>,
    ) -> Result<OAuthClient, RepositoryError> {
        let client_id = item
            .get("ClientId")
            .ok_or_else(|| RepositoryError::InternalError("Missing ClientId".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid ClientId".to_string()))?
            .clone();

        let client_secret = item
            .get("ClientSecret")
            .ok_or_else(|| RepositoryError::InternalError("Missing ClientSecret".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid ClientSecret".to_string()))?
            .clone();

        let client_name = item
            .get("ClientName")
            .ok_or_else(|| RepositoryError::InternalError("Missing ClientName".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid ClientName".to_string()))?
            .clone();

        let redirect_uris = item
            .get("RedirectUris")
            .ok_or_else(|| RepositoryError::InternalError("Missing RedirectUris".to_string()))?
            .as_ss()
            .map_err(|_| RepositoryError::InternalError("Invalid RedirectUris".to_string()))?
            .clone();

        let grant_types_str = item
            .get("GrantTypes")
            .ok_or_else(|| RepositoryError::InternalError("Missing GrantTypes".to_string()))?
            .as_ss()
            .map_err(|_| RepositoryError::InternalError("Invalid GrantTypes".to_string()))?;

        let grant_types = grant_types_str
            .iter()
            .map(|s| match s.as_str() {
                "AuthorizationCode" => GrantType::AuthorizationCode,
                "ClientCredentials" => GrantType::ClientCredentials,
                "RefreshToken" => GrantType::RefreshToken,
                "Implicit" => GrantType::Implicit,
                _ => GrantType::AuthorizationCode,
            })
            .collect();

        let response_types_str = item
            .get("ResponseTypes")
            .ok_or_else(|| RepositoryError::InternalError("Missing ResponseTypes".to_string()))?
            .as_ss()
            .map_err(|_| RepositoryError::InternalError("Invalid ResponseTypes".to_string()))?;

        let response_types = response_types_str
            .iter()
            .map(|s| match s.as_str() {
                "Code" => ResponseType::Code,
                "Token" => ResponseType::Token,
                _ => ResponseType::Code,
            })
            .collect();

        let scopes = item
            .get("Scopes")
            .ok_or_else(|| RepositoryError::InternalError("Missing Scopes".to_string()))?
            .as_ss()
            .map_err(|_| RepositoryError::InternalError("Invalid Scopes".to_string()))?
            .clone();

        let token_endpoint_auth_method_str = item
            .get("TokenEndpointAuthMethod")
            .ok_or_else(|| {
                RepositoryError::InternalError("Missing TokenEndpointAuthMethod".to_string())
            })?
            .as_s()
            .map_err(|_| {
                RepositoryError::InternalError("Invalid TokenEndpointAuthMethod".to_string())
            })?;

        let token_endpoint_auth_method = match token_endpoint_auth_method_str.as_str() {
            "ClientSecretBasic" => TokenEndpointAuthMethod::ClientSecretBasic,
            "ClientSecretPost" => TokenEndpointAuthMethod::ClientSecretPost,
            "None" => TokenEndpointAuthMethod::None,
            _ => TokenEndpointAuthMethod::ClientSecretPost,
        };

        let created_at = item
            .get("CreatedAt")
            .ok_or_else(|| RepositoryError::InternalError("Missing CreatedAt".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid CreatedAt".to_string()))?
            .parse()
            .map_err(|_| RepositoryError::InternalError("Invalid CreatedAt format".to_string()))?;

        let updated_at = item
            .get("UpdatedAt")
            .ok_or_else(|| RepositoryError::InternalError("Missing UpdatedAt".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid UpdatedAt".to_string()))?
            .parse()
            .map_err(|_| RepositoryError::InternalError("Invalid UpdatedAt format".to_string()))?;

        let is_active = *item
            .get("IsActive")
            .ok_or_else(|| RepositoryError::InternalError("Missing IsActive".to_string()))?
            .as_bool()
            .map_err(|_| RepositoryError::InternalError("Invalid IsActive".to_string()))?;

        Ok(OAuthClient {
            client_id,
            client_secret,
            client_name,
            redirect_uris,
            grant_types,
            response_types,
            scopes,
            token_endpoint_auth_method,
            created_at,
            updated_at,
            is_active,
        })
    }

    fn dynamo_item_to_authorization_code(
        &self,
        item: std::collections::HashMap<String, AttributeValue>,
    ) -> Result<AuthorizationCode, RepositoryError> {
        let code = item
            .get("Code")
            .ok_or_else(|| RepositoryError::InternalError("Missing Code".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid Code".to_string()))?
            .clone();

        let client_id = item
            .get("ClientId")
            .ok_or_else(|| RepositoryError::InternalError("Missing ClientId".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid ClientId".to_string()))?
            .clone();

        let user_id = item
            .get("UserId")
            .ok_or_else(|| RepositoryError::InternalError("Missing UserId".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid UserId".to_string()))?
            .clone();

        let redirect_uri = item
            .get("RedirectUri")
            .ok_or_else(|| RepositoryError::InternalError("Missing RedirectUri".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid RedirectUri".to_string()))?
            .clone();

        let scopes = item
            .get("Scopes")
            .ok_or_else(|| RepositoryError::InternalError("Missing Scopes".to_string()))?
            .as_ss()
            .map_err(|_| RepositoryError::InternalError("Invalid Scopes".to_string()))?
            .clone();

        let code_challenge = item
            .get("CodeChallenge")
            .and_then(|v| v.as_s().ok())
            .cloned();

        let code_challenge_method = item
            .get("CodeChallengeMethod")
            .and_then(|v| v.as_s().ok())
            .cloned();

        let expires_at = item
            .get("ExpiresAt")
            .ok_or_else(|| RepositoryError::InternalError("Missing ExpiresAt".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid ExpiresAt".to_string()))?
            .parse()
            .map_err(|_| RepositoryError::InternalError("Invalid ExpiresAt format".to_string()))?;

        let created_at = item
            .get("CreatedAt")
            .ok_or_else(|| RepositoryError::InternalError("Missing CreatedAt".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid CreatedAt".to_string()))?
            .parse()
            .map_err(|_| RepositoryError::InternalError("Invalid CreatedAt format".to_string()))?;

        let is_used = *item
            .get("IsUsed")
            .ok_or_else(|| RepositoryError::InternalError("Missing IsUsed".to_string()))?
            .as_bool()
            .map_err(|_| RepositoryError::InternalError("Invalid IsUsed".to_string()))?;

        Ok(AuthorizationCode {
            code,
            client_id,
            user_id,
            redirect_uri,
            scopes,
            code_challenge,
            code_challenge_method,
            expires_at,
            created_at,
            is_used,
        })
    }

    fn dynamo_item_to_oauth_token(
        &self,
        item: std::collections::HashMap<String, AttributeValue>,
    ) -> Result<OAuthToken, RepositoryError> {
        let access_token = item
            .get("AccessToken")
            .ok_or_else(|| RepositoryError::InternalError("Missing AccessToken".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid AccessToken".to_string()))?
            .clone();

        let token_type = item
            .get("TokenType")
            .ok_or_else(|| RepositoryError::InternalError("Missing TokenType".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid TokenType".to_string()))?
            .clone();

        let expires_in = item
            .get("ExpiresIn")
            .ok_or_else(|| RepositoryError::InternalError("Missing ExpiresIn".to_string()))?
            .as_n()
            .map_err(|_| RepositoryError::InternalError("Invalid ExpiresIn".to_string()))?
            .parse()
            .map_err(|_| RepositoryError::InternalError("Invalid ExpiresIn format".to_string()))?;

        let refresh_token = item
            .get("RefreshToken")
            .and_then(|v| v.as_s().ok())
            .cloned();

        let scope = item
            .get("Scope")
            .ok_or_else(|| RepositoryError::InternalError("Missing Scope".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid Scope".to_string()))?
            .clone();

        let client_id = item
            .get("ClientId")
            .ok_or_else(|| RepositoryError::InternalError("Missing ClientId".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid ClientId".to_string()))?
            .clone();

        let user_id = item
            .get("UserId")
            .ok_or_else(|| RepositoryError::InternalError("Missing UserId".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid UserId".to_string()))?
            .clone();

        let created_at = item
            .get("CreatedAt")
            .ok_or_else(|| RepositoryError::InternalError("Missing CreatedAt".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid CreatedAt".to_string()))?
            .parse()
            .map_err(|_| RepositoryError::InternalError("Invalid CreatedAt format".to_string()))?;

        let expires_at = item
            .get("ExpiresAt")
            .ok_or_else(|| RepositoryError::InternalError("Missing ExpiresAt".to_string()))?
            .as_s()
            .map_err(|_| RepositoryError::InternalError("Invalid ExpiresAt".to_string()))?
            .parse()
            .map_err(|_| RepositoryError::InternalError("Invalid ExpiresAt format".to_string()))?;

        let is_revoked = *item
            .get("IsRevoked")
            .ok_or_else(|| RepositoryError::InternalError("Missing IsRevoked".to_string()))?
            .as_bool()
            .map_err(|_| RepositoryError::InternalError("Invalid IsRevoked".to_string()))?;

        Ok(OAuthToken {
            access_token,
            token_type,
            expires_in,
            refresh_token,
            scope,
            client_id,
            user_id,
            created_at,
            expires_at,
            is_revoked,
        })
    }
}

pub struct EventBridgeEventPublisher {
    client: aws_sdk_eventbridge::Client,
    event_bus_name: String,
    source: String,
}

impl EventBridgeEventPublisher {
    pub fn new(client: aws_sdk_eventbridge::Client, event_bus_name: String, env: String) -> Self {
        Self {
            client,
            event_bus_name,
            source: format!("{}.users", env),
        }
    }
}

#[async_trait]
impl EventPublisher for EventBridgeEventPublisher {
    #[instrument(name = "publish-user-created-event", skip(self, user_created_event))]
    async fn publish_user_created_event(
        &self,
        user_created_event: UserCreatedEvent,
    ) -> Result<(), ()> {
        let payload = CloudEvent::new(user_created_event, "users.userCreated.v1".to_string());
        let payload_string = serde_json::to_string(&payload).expect("Error serde");

        let request = aws_sdk_eventbridge::types::builders::PutEventsRequestEntryBuilder::default()
            .set_source(Some(self.source.clone()))
            .set_detail_type(Some("users.userCreated.v1".to_string()))
            .set_detail(Some(payload_string))
            .set_event_bus_name(Some(self.event_bus_name.clone()))
            .build();
        self.client
            .put_events()
            .entries(request)
            .send()
            .await
            .map_err(|err| {
                tracing::error!("{}", err);
            })?;

        Ok(())
    }
}
