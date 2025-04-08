use aws_lambda_events::sqs::SqsEvent;
use handler::function_handler;
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use observability::{observability, trace_handler};
use opentelemetry::{global::{self, ObjectSafeSpan}, trace::{FutureExt, Tracer}};
use shared::adapters::DynamoDbRepository;
use std::env;
use tracing_subscriber::util::SubscriberInitExt;

mod handler;

#[tokio::main]
async fn main() -> Result<(), Error> {
    observability().init();
    let table_name = env::var("TABLE_NAME").expect("TABLE_NAME is not set");
    let config = aws_config::load_from_env().with_current_context().await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&config);
    let repository: DynamoDbRepository =
        DynamoDbRepository::new(dynamodb_client, table_name.clone());

    run(service_fn(|event: LambdaEvent<SqsEvent>| async {
        let tracer = global::tracer(env::var("DD_SERVICE").expect("DD_SERVICE is not set"));

        tracer
            .in_span("aws.lambda", async |cx| {
                let mut lambda_span = trace_handler(event.context.clone(), &cx);

                let res = function_handler(&repository, event)
                    .with_context(cx.clone())
                    .await;

                lambda_span.end();

                res
            })
            .with_current_context()
            .await
    }))
    .with_current_context()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use aws_lambda_events::sqs::{SqsEvent, SqsMessage};
    use lambda_runtime::LambdaEvent;
    use shared::core::{Repository, RepositoryError, User};
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_function_handler() {
        // Mock the SQS message
        let sqs_message = SqsMessage {
            message_id: Some("test_message_id".to_string()),
            receipt_handle: Some("test_receipt_handle".to_string()),
            body: Some(
                r#"{
  "id": "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
  "detail-type": "Scheduled Event",
  "source": "aws.events",
  "account": "123456789012",
  "time": "1970-01-01T00:00:00Z",
  "region": "us-east-1",
  "resources":[],
  "detail": {
    "specversion": "1.0",
    "id": "f2b46bb0-7023-48bb-9d21-8de4bc52b237",
    "source": "http://dev.orders",
    "type": "orders.orderCompleted.v1",
    "time": "2025-04-03T21:17:54.239207Z",
    "datacontenttype": "application/json",
    "traceparent": "00-1026812047235062957-8182420117871612162-01",
    "data": {
      "orderNumber": "37139d18-9cdb-4c08-afb9-33aee3102ee8",
      "userId": "16613887293977241079",
      "PublishDateTime": "2025-04-03T21:17:54",
      "EventId": "029712f4-fc0a-46ed-9464-6e8c4ddd35ab"
    },
    "_datadog": {
      "x-datadog-trace-id": "1026812047235062957",
      "x-datadog-parent-id": "15186335863144442356",
      "x-datadog-sampling-priority": "1",
      "x-datadog-tags": "_dd.p.dm=-1,_dd.p.tid=67eefb0200000000",
      "traceparent": "thetraceparent",
      "tracestate": "dd=s:1;p:d2c0b401c27fe9f4;t.dm:-1",
      "x-datadog-start-time": "1743715074239",
      "x-datadog-resource-name": "SharedEventBus-dev"
    }
  }
}"#
                .to_string(),
            ),
            md5_of_body: None,
            md5_of_message_attributes: None,
            attributes: HashMap::new(),
            message_attributes: HashMap::new(),
            event_source_arn: None,
            event_source: None,
            aws_region: None,
        };

        // Mock the SQS event
        let sqs_event = SqsEvent {
            records: vec![sqs_message],
        };

        // Mock the Lambda context
        let context = lambda_runtime::Context::default();

        // Create a mock repository
        struct MockRepository;
        #[async_trait::async_trait]
        impl Repository for MockRepository {
            async fn get_user(&self, email_address: &str) -> Result<User, RepositoryError> {
                Err(RepositoryError::NotFound)
            }

            async fn update_user_details(&self, body: &User) -> Result<(), RepositoryError> {
                Ok(())
            }
        }

        let repository = MockRepository;

        // Call the function handler
        let result =
            function_handler(&repository, LambdaEvent::new(sqs_event, context)).with_current_context().await;

        // Assert the result
        assert!(result.is_ok());
    }
}
