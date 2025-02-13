mod observability;

use std::env;
use std::sync::Arc;

use crate::observability::{configure_instrumentation, trace_layer, TracingFor};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use axum_tracing_opentelemetry::middleware::{OtelAxumLayer, OtelInResponseLayer};
use inventory_api_core::{
    DynamoDbRepository, EventBridgeEventPublisher, EventPublisher, GetStockLevelQuery,
    InventoryItem, InventoryItemErrors, InventoryItems, NoOpEventPublisher, SetStockLevelCommand,
};
use tracing::subscriber::{set_global_default, SetGlobalDefaultError};
use tracing::Span;
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::util::SubscriberInitExt;
use tower::ServiceBuilder;

pub struct AppState<
    TRepo: InventoryItems + Send + Sync,
    TEventPublisher: EventPublisher + Send + Sync,
> {
    pub repository: TRepo,
    pub event_publisher: TEventPublisher,
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let _ = configure_instrumentation();

    let event_bus_name = env::var("EVENT_BUS_NAME").expect("EVENT_BUS_NAME is not set");
    let env = env::var("DD_ENV").expect("DD_ENV is not set");
    let config = aws_config::load_from_env().await;
    let event_bridge_client = aws_sdk_eventbridge::Client::new(&config);
    let event_publisher = EventBridgeEventPublisher::new(event_bridge_client, event_bus_name, &env);

    let table_name = env::var("TABLE_NAME").expect("TABLE_NAME is not set");
    let config = aws_config::load_from_env().await;
    let dynamodb_client = match env.as_str() {
        "local" => create_dynamodb_local_client(&table_name).await,
        _ => aws_sdk_dynamodb::Client::new(&config),
    };

    let repository: DynamoDbRepository =
        DynamoDbRepository::new(dynamodb_client, table_name.clone());

    let shared_state = Arc::new(AppState {
        repository,
        event_publisher,
    });

    let service = ServiceBuilder::new().layer(trace_layer(TracingFor::Server));

    let app = Router::new()
        .route("/inventory/{product_id}", get(get_stock_level))
        .route("/inventory", post(set_stock_level))
        .route("/health", get(health_check))
        .layer(service)
        .layer(OtelInResponseLayer::default())
        .with_state(shared_state);

    let port = std::env::var("PORT").unwrap_or("8080".to_string());

    tracing::info!("Starting web server on port {}", port);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .unwrap();

    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();

    Ok(())
}

#[tracing::instrument(name = "get_stock_level", skip(state, path), fields(span.kind="server", http.route="/inventory/{productId}"))]
async fn get_stock_level<
    TRepo: InventoryItems + Send + Sync,
    TEventPublisher: EventPublisher + Send + Sync,
>(
    State(state): State<Arc<AppState<TRepo, TEventPublisher>>>,
    path: Path<String>,
) -> (StatusCode, Json<Option<InventoryItem>>) {
    let query = GetStockLevelQuery::new(path.0);
    let result = query.handle(&state.repository).await;

    match result {
        Ok(item) => {
            Span::current().set_attribute("http.status_code", 200);

            (StatusCode::OK, (Json(Some(item))))
        }
        Err(_) => {
            Span::current().set_attribute("http.status_code", 404);
            (StatusCode::NOT_FOUND, Json(None))
        }
    }
}

async fn health_check() -> (StatusCode, Json<Option<String>>) {
    (StatusCode::OK, Json(None))
}

#[tracing::instrument(name = "set_stock_level", skip(state, payload), fields(span.kind="server", http.route="/inventory"))]
async fn set_stock_level<
    TRepo: InventoryItems + Send + Sync,
    TEventPublisher: EventPublisher + Send + Sync,
>(
    State(state): State<Arc<AppState<TRepo, TEventPublisher>>>,
    Json(payload): Json<SetStockLevelCommand>,
) -> (StatusCode, Json<Option<InventoryItem>>) {
    let result = payload
        .handle(&state.repository, &state.event_publisher)
        .await;

    match result {
        Ok(item) => {
            Span::current().set_attribute("http.status_code", 200);

            (StatusCode::OK, (Json(Some(item))))
        }
        Err(e) => match e {
            InventoryItemErrors::InvalidStock(_, _) => {
                Span::current().set_attribute("http.status_code", 400);
                (StatusCode::BAD_REQUEST, (Json(None)))
            }
            InventoryItemErrors::NotFound(_) => {
                Span::current().set_attribute("http.status_code", 404);
                (StatusCode::NOT_FOUND, (Json(None)))
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, {
                Span::current().set_attribute("http.status_code", 500);
                Json(None)
            }),
        },
    }
}

async fn shutdown_signal() {
    use std::sync::mpsc;
    use std::{thread, time::Duration};

    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::warn!("signal received, starting graceful shutdown");
    let (sender, receiver) = mpsc::channel();
    let _ = thread::spawn(move || {
        opentelemetry::global::shutdown_tracer_provider();
        sender.send(()).ok()
    });
    let shutdown_res = receiver.recv_timeout(Duration::from_millis(2_000));
    if shutdown_res.is_err() {
        tracing::error!("failed to shutdown OpenTelemetry");
    }
}

async fn create_dynamodb_local_client(table_name: &String) -> aws_sdk_dynamodb::Client {
    let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .test_credentials()
        // DynamoDB run locally uses port 8000 by default.
        .endpoint_url("http://localhost:8000")
        .load()
        .await;
    let dynamodb_local_config = aws_sdk_dynamodb::config::Builder::from(&config).build();

    let client = aws_sdk_dynamodb::Client::from_conf(dynamodb_local_config);

    let list_resp = client.list_tables().send().await;
    match list_resp {
        Ok(resp) => {
            if !resp.table_names().contains(table_name) {
                println!("Table {} not found, creating it...", table_name);
                let create_table_resp = client
                    .create_table()
                    .table_name(table_name)
                    .attribute_definitions(
                        aws_sdk_dynamodb::types::AttributeDefinition::builder()
                            .attribute_name("PK")
                            .attribute_type(aws_sdk_dynamodb::types::ScalarAttributeType::S)
                            .build()
                            .unwrap(),
                    )
                    .key_schema(
                        aws_sdk_dynamodb::types::KeySchemaElement::builder()
                            .attribute_name("PK")
                            .key_type(aws_sdk_dynamodb::types::KeyType::Hash)
                            .build()
                            .unwrap(),
                    )
                    .provisioned_throughput(
                        aws_sdk_dynamodb::types::ProvisionedThroughput::builder()
                            .read_capacity_units(5)
                            .write_capacity_units(5)
                            .build()
                            .unwrap(),
                    )
                    .send()
                    .await;

                match create_table_resp {
                    Ok(_) => println!("Table {} created successfully", table_name),
                    Err(err) => eprintln!("Failed to create table {}: {err:?}", table_name),
                }
            } else {
                println!("Table {} already exists", table_name);
            }
        }
        Err(err) => eprintln!("Failed to list local dynamodb tables: {err:?}"),
    }

    client
}
