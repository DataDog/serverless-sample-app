use crate::core::{EventPublisher, Repository, RepositoryError, User, UserCreatedEvent, UserDetails};
use async_trait::async_trait;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client;
use aws_sdk_dynamodb::config::http::HttpResponse;
use aws_sdk_dynamodb::error::SdkError;
use aws_sdk_dynamodb::operation::put_item::PutItemError;
use observability::{parse_name_from_arn, TracedMessage};
use tracing::{instrument, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;

pub struct DynamoDbRepository {
    client: Client,
    table_name: String,
}

const PARTITION_KEY: &str = "PK";
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
        
        let (details) = match user {
            User::Standard(details) => (details),
            User::Premium(details) => (details),
            User::Admin(details) => (details),
        };

        tracing::info!("Sending put item request");
        
        let put_item_builder = self
            .client
            .put_item()
            .table_name(&self.table_name)
            .item(PARTITION_KEY, AttributeValue::S(details.email_address.clone()))
            .item(FIRST_NAME_KEY, AttributeValue::S(details.first_name.clone()))
            .item(LAST_NAME_KEY, AttributeValue::S(details.last_name.clone()))
            .item(EMAIL_ADDRESS_KEY, AttributeValue::S(details.email_address.clone()))
            .item(USER_ID_KEY, AttributeValue::S(details.user_id.clone()))
            .item(PASSWORD_HASH_KEY, AttributeValue::S(details.password_hash.clone()))
            .item(USER_TYPE_KEY, AttributeValue::S(user.user_type().to_string()))
            .item(CREATED_AT_KEY, AttributeValue::S(details.created_at.to_string()))
            .item(ORDER_COUNT_KEY, AttributeValue::N(details.order_count.to_string()));

        let res = if details.last_active.is_some() {
            put_item_builder.clone().item(
                LAST_ACTIVE_KEY,
                AttributeValue::S(details.last_active.clone().unwrap().to_string()),
            );
            
            put_item_builder
                .send()
                .await
        } else {
            put_item_builder
            .send()
            .await
        };

        match res {
            Ok(_) => Ok(()),
            Err(e) => {
                let error_message = match e {
                    SdkError::ConstructionFailure(_) => "construction failure",
                    SdkError::TimeoutError(_) => "timeout error",
                    SdkError::DispatchFailure(_) => "dispatch failure",
                    SdkError::ResponseError(_) => "response error",
                    SdkError::ServiceError(e) => {
                        match e.err(){
                            PutItemError::ConditionalCheckFailedException(_) => "conditional check failed",
                            PutItemError::InternalServerError(_) => "DynamoDB internal server error",
                            PutItemError::InvalidEndpointException(_) => "invalid endpoint",
                            PutItemError::ItemCollectionSizeLimitExceededException(_) => "item collection size limit exceeded",
                            PutItemError::ProvisionedThroughputExceededException(_) => "provisioned throughput exceeded",
                            PutItemError::ReplicatedWriteConflictException(_) => "replicated write conflict",
                            PutItemError::RequestLimitExceeded(_) => "request limit exceeded",
                            PutItemError::ResourceNotFoundException(_) => "resource not found",
                            PutItemError::TransactionConflictException(_) => "transaction conflict",
                            _ => "unknown error"
                        }
                    }
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

        let res = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key(PARTITION_KEY, AttributeValue::S(email_address.to_string()))
            .send()
            .await;

        match res {
            Ok(item) => Ok({
                if item.item.is_none() {
                    return Err(RepositoryError::NotFound);
                }

                let attributes = item.item().unwrap().clone();

                let user_details = UserDetails {
                    email_address: attributes.get(EMAIL_ADDRESS_KEY).unwrap().as_s().unwrap().clone(),
                    first_name: attributes.get(FIRST_NAME_KEY).unwrap().as_s().unwrap().clone(),
                    last_name: attributes.get(LAST_NAME_KEY).unwrap().as_s().unwrap().clone(),
                    user_id: attributes.get(USER_ID_KEY).unwrap().as_s().unwrap().clone(),
                    password_hash: attributes.get(PASSWORD_HASH_KEY).unwrap().as_s().unwrap().clone(),
                    created_at: attributes.get(CREATED_AT_KEY).unwrap().as_s().unwrap().parse().unwrap(),
                    last_active: match attributes.get(LAST_ACTIVE_KEY) {
                        Some(value) => Some(value.as_s().unwrap().parse().unwrap()),
                        None => None,  
                    },
                    order_count: attributes.get(ORDER_COUNT_KEY).unwrap().as_n().unwrap().parse().unwrap(),
                };

                User::from_details(user_details, &attributes.get(USER_TYPE_KEY).unwrap().as_s().unwrap().clone())?
            }),
            Err(_e) => Err(RepositoryError::NotFound),
        }
    }

    #[instrument(name = "update_user_details", skip(self, body))]
    async fn update_user_details(&self, body: &User) -> Result<(), RepositoryError> {
        Span::current().set_attribute("peer.service", self.table_name.clone());
        self.put_to_dynamo(body).await
    }
}

pub struct SnsEventPublisher {
    client: aws_sdk_sns::Client,
}

impl SnsEventPublisher {
    pub fn new(client: aws_sdk_sns::Client) -> SnsEventPublisher {
        SnsEventPublisher { client }
    }
}

#[async_trait]
impl EventPublisher for SnsEventPublisher {
    #[instrument(
        name = "publish-user-created-event",
        skip(self, user_created_event)
    )]
    async fn publish_user_created_event(&self, user_created_event: UserCreatedEvent) -> Result<(), ()> {
        Span::current().set_attribute(
            "peer.service",
            parse_name_from_arn(&std::env::var("USER_CREATED_TOPIC_ARN").unwrap()),
        );
        tracing::Span::current().set_attribute(
            "peer.messaging.destination",
            std::env::var("USER_CREATED_TOPIC_ARN").unwrap(),
        );
        let _publish_res = &self
            .client
            .publish()
            .topic_arn(std::env::var("USER_CREATED_TOPIC_ARN").unwrap())
            .message(serde_json::to_string(&TracedMessage::new(user_created_event)).unwrap())
            .send()
            .await;

        Ok(())
    }
}
