//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

use lambda_http::http::StatusCode;
use lambda_http::{
    run, service_fn,
    tracing::{self, instrument},
    Error, IntoResponse, Request, RequestExt, RequestPayloadExt,
};
use opentelemetry::global::{self, ObjectSafeSpan};
use opentelemetry::trace::Tracer;
use shared::response::{empty_response, json_response};

use observability::{observability, trace_request};
use shared::adapters::{DynamoDbRepository, EventBridgeEventPublisher};
use shared::core::{EventPublisher, Repository};
use shared::ports::CreateUserCommand;
use std::env;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "POST /user", skip(client, event_publisher, event), fields(api.method = event.method().as_str(), api.route = event.raw_http_path()))]
async fn function_handler<TRepository: Repository, TEventPublisher: EventPublisher>(
    client: &TRepository,
    event_publisher: &TEventPublisher,
    event: Request,
) -> Result<impl IntoResponse, Error> {
    tracing::info!("Received event: {:?}", event);

    let request_body = event.payload::<CreateUserCommand>()?;

    match request_body {
        None => empty_response(&StatusCode::BAD_REQUEST),
        Some(command) => {
            let result = command.handle(client, event_publisher).await;

            match result {
                Ok(response) => json_response(&StatusCode::OK, &response),
                Err(e) => {
                    tracing::error!("Failed to create product: {:?}", e);
                    empty_response(&StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    observability().init();

    let table_name = env::var("TABLE_NAME").expect("TABLE_NAME is not set");
    let config = aws_config::load_from_env().await;
    let dynamodb_client = aws_sdk_dynamodb::Client::new(&config);
    let repository: DynamoDbRepository =
        DynamoDbRepository::new(dynamodb_client, table_name.clone());

    let event_bus_name = env::var("EVENT_BUS_NAME").expect("EVENT_BUS_NAME is not set");
    let env = env::var("ENV").expect("ENV is not set");

    let sns_client = aws_sdk_eventbridge::Client::new(&config);
    let event_publisher = EventBridgeEventPublisher::new(sns_client, event_bus_name, env);

    // Seed default admin user
    seed_default_user(&repository, &event_publisher).await;

    run(service_fn(|event: Request| async {
        let tracer = global::tracer(env::var("DD_SERVICE").expect("DD_SERVICE is not set"));

        tracer
            .in_span("handle_request", async |cx| {
                let mut handler_span = trace_request(&event, &cx);

                let res = function_handler(&repository, &event_publisher, event).await;

                handler_span.end();

                res
            })
            .await
    }))
    .await
}

async fn seed_default_user<TRepository: Repository, TEventPublisher: EventPublisher>(
    repository: &TRepository,
    sns_event_publisher: &TEventPublisher,
) {
    let create_user_command = CreateUserCommand::new_admin_user(
        "admin@serverless-sample.com".to_string(),
        "Admin".to_string(),
        "Serverless".to_string(),
        "Admin!23".to_string(),
    );

    let _ = create_user_command
        .handle(repository, sns_event_publisher)
        .await;
}
