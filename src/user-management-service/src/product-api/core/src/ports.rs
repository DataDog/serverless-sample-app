use crate::core::{
    EventPublisher, Product, ProductDTO, ProductPriceBracket, Repository, RepositoryError,
};
use serde::Deserialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ApplicationError {
    #[error("Product not found")]
    NotFound,
    #[error("Error: {0}")]
    InvalidInput(String),
    #[error("Error: {0}")]
    InternalError(String),
}

#[derive(Deserialize)]
pub struct CreateProductCommand {
    name: String,
    price: f32,
}

pub async fn handle_create_product<TRepo: Repository, TEventPublisher: EventPublisher>(
    repository: &TRepo,
    event_publisher: &TEventPublisher,
    create_product_command: CreateProductCommand,
) -> Result<ProductDTO, ApplicationError> {
    let current_span = tracing::Span::current();
    current_span.record("product.name", &create_product_command.name);
    current_span.record("product.price", &create_product_command.price);

    let product = Product::new(create_product_command.name, create_product_command.price);

    let _res = repository.store_product(&product).await;

    current_span.record("product.id", &product.product_id);

    event_publisher
        .publish_product_created_event(product.clone().into())
        .await
        .map_err(|_e| ApplicationError::InternalError("Failure publishing event".to_string()))?;

    Ok(product.as_dto())
}

#[derive(Deserialize)]
pub struct UpdateProductCommand {
    #[serde(rename = "id")]
    product_id: String,
    name: String,
    price: f32,
}

pub async fn handle_update_product<TRepo: Repository, TEventPublisher: EventPublisher>(
    repository: &TRepo,
    event_publisher: &TEventPublisher,
    update_product_command: UpdateProductCommand,
) -> Result<ProductDTO, ApplicationError> {
    let get_product_result = repository
        .get_product(&update_product_command.product_id)
        .await
        .map_err(|e| match e {
            RepositoryError::NotFound => ApplicationError::NotFound,
            RepositoryError::InternalError(e) => ApplicationError::InternalError(e),
        })?;

    let product =
        get_product_result.update(update_product_command.name, update_product_command.price);

    if !product.updated {
        return Ok(product.as_dto());
    }

    match repository.update_product(&product).await {
        Ok(_) => {
            event_publisher
                .publish_product_updated_event(product.clone().into())
                .await
                .map_err(|_e| {
                    ApplicationError::InternalError("Failure publishing event".to_string())
                })?;
            Ok(product.as_dto())
        }
        Err(e) => Err(ApplicationError::InternalError(e.to_string())),
    }
}
#[derive(Deserialize)]
pub struct DeleteProductCommand {
    product_id: String,
}

impl DeleteProductCommand {
    pub fn new(product_id: String) -> Self {
        Self { product_id }
    }
}

pub async fn handle_delete_product<TRepo: Repository, TEventPublisher: EventPublisher>(
    repository: &TRepo,
    event_publisher: &TEventPublisher,
    delete_product_command: DeleteProductCommand,
) -> Result<(), ApplicationError> {
    let product = repository
        .get_product(&delete_product_command.product_id)
        .await;

    match product {
        Ok(product) => {
            repository
                .delete_product(&delete_product_command.product_id)
                .await
                .map_err(|e| ApplicationError::InternalError(e.to_string()))?;

            event_publisher
                .publish_product_deleted_event(product.clone().into())
                .await
                .map_err(|_e| {
                    ApplicationError::InternalError("Failure publishing event".to_string())
                })?;

            Ok(())
        }
        Err(_) => Err(ApplicationError::NotFound),
    }
}

#[derive(Deserialize)]
pub struct ListProductsQuery {}

impl ListProductsQuery {
    pub fn new() -> Self {
        Self {}
    }
}

pub async fn execute_list_products_query<T: Repository>(
    repository: &T,
    _list_products_query: ListProductsQuery,
) -> Result<Vec<ProductDTO>, ApplicationError> {
    let products = repository.list_products().await.map_err(|e| match e {
        RepositoryError::NotFound => ApplicationError::NotFound,
        RepositoryError::InternalError(e) => ApplicationError::InternalError(e),
    })?;

    let mut product_response = vec![];

    for product in products {
        product_response.push(product.as_dto());
    }

    Ok(product_response)
}

#[derive(Deserialize)]
pub struct GetProductQuery {
    product_id: String,
}

impl GetProductQuery {
    pub fn new(product_id: String) -> Self {
        Self { product_id }
    }
}

pub async fn execute_get_product_query<T: Repository>(
    repository: &T,
    get_product_query: GetProductQuery,
) -> Result<ProductDTO, ApplicationError> {
    let product = repository
        .get_product(&get_product_query.product_id)
        .await
        .map_err(|e| match e {
            RepositoryError::NotFound => ApplicationError::NotFound,
            RepositoryError::InternalError(e) => ApplicationError::InternalError(e),
        })?;

    Ok(product.as_dto())
}

#[derive(Deserialize)]
pub struct PricingUpdatedEvent {
    product_id: String,
    price_brackets: Vec<PricingResult>,
}

#[derive(Deserialize)]
pub(crate) struct PricingResult {
    quantity_to_order: i32,
    price: f32,
}

pub async fn handle_pricing_updated_event<T: Repository>(
    repository: &T,
    evt: PricingUpdatedEvent,
) -> Result<(), ApplicationError> {
    let mut product = repository
        .get_product(&evt.product_id)
        .await
        .map_err(|e| match e {
            RepositoryError::NotFound => ApplicationError::NotFound,
            RepositoryError::InternalError(e) => ApplicationError::InternalError(e),
        })?;

    product = product.clear_pricing();

    for price_bracket in evt.price_brackets {
        product = product.add_price(ProductPriceBracket::new(
            price_bracket.quantity_to_order,
            price_bracket.price,
        ));
    }

    repository
        .update_product(&product)
        .await
        .map_err(|e| ApplicationError::InternalError(e.to_string()))?;

    Ok(())
}

#[derive(Deserialize)]
pub struct StockUpdatedEvent {
    product_id: String,
    stock_level: i32,
}

pub async fn handle_stock_updated_event<T: Repository>(
    repository: &T,
    evt: StockUpdatedEvent,
) -> Result<(), ApplicationError> {
    let mut product = repository
        .get_product(&evt.product_id)
        .await
        .map_err(|e| match e {
            RepositoryError::NotFound => ApplicationError::NotFound,
            RepositoryError::InternalError(e) => ApplicationError::InternalError(e),
        })?;

    product.update_stock_level(evt.stock_level);

    repository
        .update_product(&product)
        .await
        .map_err(|e| ApplicationError::InternalError(e.to_string()))?;

    Ok(())
}
