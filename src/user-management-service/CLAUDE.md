# Development Guidelines for Rust

## Service Overview

**Runtime: Rust**

**AWS Services Used: API Gateway, Lambda, SQS, DynamoDB, EventBridge**

The user management services manages everything related to user accounts. It allows users to register and login, generating a JWT that is used by other services to authenticate. It also tracks the number of orders a user has placed. It is made up of 2 independent services

1. The `Api` provides various API endpoints to register new users, login and retrieve details about a given user
2. The `BackgroundWorker` service is an [anti-corruption layer](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer) that consumes events published by external services, translates them to internal events and processes them

The Rust implementation uses Open Telemetry for all of the tracing, which means trace propagation through SNS/SQS/EventBridge needs to be done manually. Both from a producer and a consumer perspective. All of the logic to propagate traces is held in a shared [`observability`](./src/observability/) crate. All of the logic is contained in the [`TracedMessage`](./src/observability/src/lib.rs) struct.

Messages are published using the `TracedMessage` struct as a wrapper, to ensure trace and span id's are consistently sent. The `From` trait is used at the consumer side to transform the Lambda Event struct `SnsEvent`, `SqsEvent` etc back into a `TracedMessage`.

## Core Philosophy

**TEST-DRIVEN DEVELOPMENT IS NON-NEGOTIABLE.** Every single line of production code must be written in response to a failing test. No exceptions. This is not a suggestion or a preference - it is the fundamental practice that enables all other principles in this document.

I follow Test-Driven Development (TDD) with a strong emphasis on behavior-driven testing and leveraging Rust's ownership system for safe, concurrent applications. All work should be done in small, incremental changes that maintain a working state throughout development.

## Quick Reference

**Key Principles:**

- Write tests first (TDD)
- Test behavior, not implementation
- Leverage Rust's type system for correctness
- Embrace ownership and borrowing
- Zero-cost abstractions
- Fearless concurrency
- Use latest stable Rust features
- Use real models/DTOs in tests, never redefine them

**Preferred Tools:**

- **Language**: Rust (latest stable)
- **Web Framework**: Axum
- **Testing**: Built-in `cargo test` + `rstest` for parameterized tests
- **Async Runtime**: Tokio
- **Serialization**: serde with serde_json
- **Database**: sqlx with compile-time checked queries
- **Validation**: validator crate
- **HTTP Client**: reqwest

## Testing Principles

### Behavior-Driven Testing

- **No "unit tests"** - this term is not helpful. Tests should verify expected behavior, treating implementation as a black box
- Test through the public API exclusively - private functions should be invisible to tests
- No 1:1 mapping between test files and implementation files
- Tests that examine internal implementation details are wasteful and should be avoided
- **Coverage targets**: 100% coverage should be expected at all times, but these tests must ALWAYS be based on business behaviour, not implementation details
- Tests must document expected business behaviour

### Testing Tools

- **Built-in test framework** with `cargo test`
- **rstest** for parameterized tests and fixtures
- **tokio-test** for async testing utilities
- **testcontainers** for integration testing with real dependencies
- **mockall** for mocking when absolutely necessary (prefer real implementations)
- All test code must follow the same Rust standards as production code

### Test Organization

```
src/
  domain/
    payment/
      mod.rs
      processor.rs
      validator.rs
  infrastructure/
    persistence/
      payment_repository.rs
  application/
    payment_service.rs
tests/
  integration/
    payment_tests.rs  // Tests the complete payment flow through public API
  common/
    mod.rs           // Shared test utilities and builders
```

### Test Data Pattern

Use builder pattern with fluent interfaces for test data:

```rust
use crate::domain::payment::{PaymentRequest, AddressDetails, PayingCardDetails};
use rust_decimal::Decimal;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct PaymentRequestBuilder {
    amount: Decimal,
    currency: String,
    card_id: String,
    customer_id: Uuid,
    description: Option<String>,
    metadata: Option<HashMap<String, serde_json::Value>>,
    idempotency_key: Option<String>,
    address_details: AddressDetails,
    paying_card_details: PayingCardDetails,
}

impl Default for PaymentRequestBuilder {
    fn default() -> Self {
        Self {
            amount: Decimal::from(100),
            currency: "GBP".to_string(),
            card_id: "card_123".to_string(),
            customer_id: Uuid::new_v4(),
            description: None,
            metadata: None,
            idempotency_key: None,
            address_details: AddressDetailsBuilder::default().build(),
            paying_card_details: PayingCardDetailsBuilder::default().build(),
        }
    }
}

impl PaymentRequestBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_amount(mut self, amount: Decimal) -> Self {
        self.amount = amount;
        self
    }

    pub fn with_currency(mut self, currency: impl Into<String>) -> Self {
        self.currency = currency.into();
        self
    }

    pub fn with_card_id(mut self, card_id: impl Into<String>) -> Self {
        self.card_id = card_id.into();
        self
    }

    pub fn with_customer_id(mut self, customer_id: Uuid) -> Self {
        self.customer_id = customer_id;
        self
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn with_metadata(mut self, metadata: HashMap<String, serde_json::Value>) -> Self {
        self.metadata = Some(metadata);
        self
    }

    pub fn with_idempotency_key(mut self, key: impl Into<String>) -> Self {
        self.idempotency_key = Some(key.into());
        self
    }

    pub fn with_address_details(mut self, address_details: AddressDetails) -> Self {
        self.address_details = address_details;
        self
    }

    pub fn with_paying_card_details(mut self, paying_card_details: PayingCardDetails) -> Self {
        self.paying_card_details = paying_card_details;
        self
    }

    pub fn build(self) -> PaymentRequest {
        PaymentRequest {
            amount: self.amount,
            currency: self.currency,
            card_id: self.card_id,
            customer_id: self.customer_id,
            description: self.description,
            metadata: self.metadata,
            idempotency_key: self.idempotency_key,
            address_details: self.address_details,
            paying_card_details: self.paying_card_details,
        }
    }
}

#[derive(Debug, Clone)]
pub struct AddressDetailsBuilder {
    house_number: String,
    house_name: Option<String>,
    address_line1: String,
    address_line2: Option<String>,
    city: String,
    postcode: String,
}

impl Default for AddressDetailsBuilder {
    fn default() -> Self {
        Self {
            house_number: "123".to_string(),
            house_name: Some("Test House".to_string()),
            address_line1: "Test Address Line 1".to_string(),
            address_line2: Some("Test Address Line 2".to_string()),
            city: "Test City".to_string(),
            postcode: "SW1A 1AA".to_string(),
        }
    }
}

impl AddressDetailsBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_house_number(mut self, house_number: impl Into<String>) -> Self {
        self.house_number = house_number.into();
        self
    }

    pub fn with_house_name(mut self, house_name: Option<String>) -> Self {
        self.house_name = house_name;
        self
    }

    pub fn with_address_line1(mut self, address_line1: impl Into<String>) -> Self {
        self.address_line1 = address_line1.into();
        self
    }

    pub fn with_address_line2(mut self, address_line2: Option<String>) -> Self {
        self.address_line2 = address_line2;
        self
    }

    pub fn with_city(mut self, city: impl Into<String>) -> Self {
        self.city = city.into();
        self
    }

    pub fn with_postcode(mut self, postcode: impl Into<String>) -> Self {
        self.postcode = postcode.into();
        self
    }

    pub fn build(self) -> AddressDetails {
        AddressDetails {
            house_number: self.house_number,
            house_name: self.house_name,
            address_line1: self.address_line1,
            address_line2: self.address_line2,
            city: self.city,
            postcode: self.postcode,
        }
    }
}

// Usage in tests
#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn test_payment_request_builder() {
        let mut metadata = HashMap::new();
        metadata.insert("order_id".to_string(), serde_json::Value::String("order_789".to_string()));

        let payment_request = PaymentRequestBuilder::new()
            .with_amount(dec!(250.00))
            .with_currency("USD")
            .with_metadata(metadata)
            .with_address_details(
                AddressDetailsBuilder::new()
                    .with_city("London")
                    .with_postcode("E1 6AN")
                    .build()
            )
            .build();

        assert_eq!(payment_request.amount, dec!(250.00));
        assert_eq!(payment_request.currency, "USD");
        assert_eq!(payment_request.address_details.city, "London");
    }
}
```

Key principles:

- Always return complete objects with sensible defaults using `Default` trait
- Use fluent interfaces for readable test setup
- Build incrementally - extract nested object builders as needed
- Compose builders for complex objects
- Make builders by-value (consuming) for immutability

## Rust Language Features and Project Structure

### Project Structure (Ports and Adapters Simplified)

```
src/
  main.rs                    # Application entry point
  lib.rs                     # Library root with public exports
  domain/                    # Core business logic (ports)
    mod.rs
    payment/
      mod.rs
      entities.rs             # Domain entities
      value_objects.rs        # Value objects and types
      repository.rs           # Repository trait (port)
      service.rs              # Domain service trait (port)
      errors.rs               # Domain-specific errors
  application/               # Use cases and application services
    mod.rs
    payment/
      mod.rs
      service.rs              # Application service implementation
      dto.rs                  # Data transfer objects
      handlers.rs             # Command/query handlers
  infrastructure/            # External concerns (adapters)
    mod.rs
    persistence/
      mod.rs
      payment_repository.rs   # Repository implementation (adapter)
    http/
      mod.rs
      client.rs               # HTTP client adapter
      server.rs               # HTTP server setup
    config/
      mod.rs
      settings.rs             # Configuration management
  web/                       # Web layer
    mod.rs
    routes/
      mod.rs
      payment_routes.rs       # Axum route handlers
    middleware/
      mod.rs
      auth.rs                 # Authentication middleware
      logging.rs              # Request logging
      error_handling.rs       # Error handling middleware
    extractors/
      mod.rs
      validation.rs           # Custom extractors
tests/
  integration/
    payment_integration_tests.rs
  common/
    mod.rs
    test_builders.rs
    database.rs
```

### Domain Layer - Core Types and Entities

```rust
// src/domain/payment/entities.rs
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaymentId(pub Uuid);

impl PaymentId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn from_uuid(id: Uuid) -> Self {
        Self(id)
    }

    pub fn inner(&self) -> Uuid {
        self.0
    }
}

impl Default for PaymentId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for PaymentId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CustomerId(pub Uuid);

impl CustomerId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn from_uuid(id: Uuid) -> Self {
        Self(id)
    }

    pub fn inner(&self) -> Uuid {
        self.0
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PaymentStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

impl Default for PaymentStatus {
    fn default() -> Self {
        PaymentStatus::Pending
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Payment {
    pub id: PaymentId,
    pub amount: Decimal,
    pub currency: String,
    pub customer_id: CustomerId,
    pub card_id: String,
    pub status: PaymentStatus,
    pub description: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub created_at: DateTime<Utc>,
    pub processed_at: Option<DateTime<Utc>>,
}

impl Payment {
    pub fn new(
        amount: Decimal,
        currency: String,
        customer_id: CustomerId,
        card_id: String,
    ) -> Self {
        Self {
            id: PaymentId::new(),
            amount,
            currency,
            customer_id,
            card_id,
            status: PaymentStatus::default(),
            description: None,
            metadata: None,
            created_at: Utc::now(),
            processed_at: None,
        }
    }

    pub fn mark_as_processed(&mut self) -> Result<(), PaymentError> {
        match self.status {
            PaymentStatus::Pending => {
                self.status = PaymentStatus::Completed;
                self.processed_at = Some(Utc::now());
                Ok(())
            }
            _ => Err(PaymentError::InvalidStateTransition {
                from: self.status.clone(),
                to: PaymentStatus::Completed,
            }),
        }
    }

    pub fn mark_as_failed(&mut self) -> Result<(), PaymentError> {
        match self.status {
            PaymentStatus::Pending | PaymentStatus::Processing => {
                self.status = PaymentStatus::Failed;
                self.processed_at = Some(Utc::now());
                Ok(())
            }
            _ => Err(PaymentError::InvalidStateTransition {
                from: self.status.clone(),
                to: PaymentStatus::Failed,
            }),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AddressDetails {
    pub house_number: String,
    pub house_name: Option<String>,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub city: String,
    pub postcode: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PayingCardDetails {
    pub card_number: String,
    pub expiry_month: u8,
    pub expiry_year: u16,
    pub cvv: String,
    pub cardholder_name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PaymentRequest {
    pub amount: Decimal,
    pub currency: String,
    pub card_id: String,
    pub customer_id: CustomerId,
    pub description: Option<String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub idempotency_key: Option<String>,
    pub address_details: AddressDetails,
    pub paying_card_details: PayingCardDetails,
}

// src/domain/payment/errors.rs
use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq)]
pub enum PaymentError {
    #[error("Invalid state transition from {from:?} to {to:?}")]
    InvalidStateTransition {
        from: PaymentStatus,
        to: PaymentStatus,
    },
    #[error("Payment amount must be positive, got {amount}")]
    InvalidAmount { amount: Decimal },
    #[error("Invalid currency: {currency}")]
    InvalidCurrency { currency: String },
    #[error("Payment not found with id: {id}")]
    NotFound { id: PaymentId },
    #[error("Validation failed: {message}")]
    ValidationFailed { message: String },
    #[error("External service error: {message}")]
    ExternalServiceError { message: String },
}

pub use PaymentError as Error;
```

### Result Pattern and Error Handling

```rust
// src/domain/common/result.rs
use std::fmt;

pub type Result<T, E = Box<dyn std::error::Error + Send + Sync>> = std::result::Result<T, E>;

// For domain-specific results
pub type PaymentResult<T> = std::result::Result<T, crate::domain::payment::Error>;

// Extension traits for Result
pub trait ResultExt<T, E> {
    fn map_err_to_string(self) -> Result<T, String>;
    fn log_error(self, logger: &tracing::Span) -> Self;
}

impl<T, E: fmt::Display> ResultExt<T, E> for std::result::Result<T, E> {
    fn map_err_to_string(self) -> Result<T, String> {
        self.map_err(|e| e.to_string()).map_err(|e| e.into())
    }

    fn log_error(self, _logger: &tracing::Span) -> Self {
        if let Err(ref e) = self {
            tracing::error!("Operation failed: {}", e);
        }
        self
    }
}
```

### Repository Pattern (Port)

```rust
// src/domain/payment/repository.rs
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use crate::domain::payment::{Payment, PaymentId, CustomerId, PaymentStatus, Error};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct PagedResult<T> {
    pub data: Vec<T>,
    pub page: usize,
    pub page_size: usize,
    pub total_count: usize,
    pub total_pages: usize,
}

impl<T> PagedResult<T> {
    pub fn new(data: Vec<T>, page: usize, page_size: usize, total_count: usize) -> Self {
        let total_pages = (total_count + page_size - 1) / page_size; // Ceiling division
        Self {
            data,
            page,
            page_size,
            total_count,
            total_pages,
        }
    }

    pub fn has_next_page(&self) -> bool {
        self.page < self.total_pages
    }

    pub fn has_previous_page(&self) -> bool {
        self.page > 1
    }
}

#[async_trait]
pub trait PaymentRepository: Send + Sync {
    async fn get_by_id(&self, id: &PaymentId) -> Result<Option<Payment>, Error>;

    async fn get_by_customer_id(&self, customer_id: &CustomerId) -> Result<Vec<Payment>, Error>;

    async fn get_paged(
        &self,
        page: usize,
        page_size: usize,
        status: Option<PaymentStatus>,
        from_date: Option<DateTime<Utc>>,
        to_date: Option<DateTime<Utc>>,
    ) -> Result<PagedResult<Payment>, Error>;

    async fn save(&self, payment: &Payment) -> Result<(), Error>;

    async fn delete(&self, id: &PaymentId) -> Result<(), Error>;

    async fn exists(&self, id: &PaymentId) -> Result<bool, Error>;

    async fn get_total_amount_by_customer(
        &self,
        customer_id: &CustomerId,
        from_date: DateTime<Utc>,
        to_date: DateTime<Utc>,
    ) -> Result<rust_decimal::Decimal, Error>;
}

pub type DynPaymentRepository = Arc<dyn PaymentRepository>;
```

### Validation with validator crate

```rust
// src/application/payment/dto.rs
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationError};
use rust_decimal::Decimal;
use uuid::Uuid;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreatePaymentRequest {
    #[validate(range(min = 0.01, max = 10000.0, message = "Amount must be between 0.01 and 10,000"))]
    pub amount: Decimal,

    #[validate(length(equal = 3, message = "Currency must be a 3-letter ISO code"))]
    #[validate(custom = "validate_currency")]
    pub currency: String,

    #[validate(length(min = 1, message = "Card ID cannot be empty"))]
    pub card_id: String,

    pub customer_id: Uuid,

    #[validate(length(max = 500, message = "Description cannot exceed 500 characters"))]
    pub description: Option<String>,

    pub metadata: Option<HashMap<String, serde_json::Value>>,

    pub idempotency_key: Option<String>,

    #[validate]
    pub address_details: AddressDetailsDto,

    #[validate]
    pub paying_card_details: PayingCardDetailsDto,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct AddressDetailsDto {
    #[validate(length(min = 1, message = "House number is required"))]
    pub house_number: String,

    #[validate(length(max = 100, message = "House name cannot exceed 100 characters"))]
    pub house_name: Option<String>,

    #[validate(length(min = 1, message = "Address line 1 is required"))]
    pub address_line1: String,

    #[validate(length(max = 200, message = "Address line 2 cannot exceed 200 characters"))]
    pub address_line2: Option<String>,

    #[validate(length(min = 1, message = "City is required"))]
    pub city: String,

    #[validate(regex = "POSTCODE_REGEX", message = "Invalid UK postcode format"))]
    pub postcode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct PayingCardDetailsDto {
    #[validate(length(equal = 16, message = "Card number must be 16 digits"))]
    #[validate(custom = "validate_card_number")]
    pub card_number: String,

    #[validate(range(min = 1, max = 12, message = "Expiry month must be between 1 and 12"))]
    pub expiry_month: u8,

    #[validate(range(min = 2024, max = 2050, message = "Expiry year must be valid"))]
    pub expiry_year: u16,

    #[validate(length(min = 3, max = 4, message = "CVV must be 3 or 4 digits"))]
    pub cvv: String,

    #[validate(length(min = 1, max = 100, message = "Cardholder name is required"))]
    pub cardholder_name: String,
}

lazy_static::lazy_static! {
    static ref POSTCODE_REGEX: regex::Regex = regex::Regex::new(
        r"^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$"
    ).unwrap();
}

fn validate_currency(currency: &str) -> Result<(), ValidationError> {
    const VALID_CURRENCIES: &[&str] = &["GBP", "USD", "EUR"];

    if VALID_CURRENCIES.contains(&currency) {
        Ok(())
    } else {
        Err(ValidationError::new("invalid_currency"))
    }
}

fn validate_card_number(card_number: &str) -> Result<(), ValidationError> {
    // Simple Luhn algorithm check
    if !card_number.chars().all(|c| c.is_ascii_digit()) {
        return Err(ValidationError::new("card_number_not_numeric"));
    }

    let sum: u32 = card_number
        .chars()
        .rev()
        .enumerate()
        .map(|(i, c)| {
            let mut digit = c.to_digit(10).unwrap();
            if i % 2 == 1 {
                digit *= 2;
                if digit > 9 {
                    digit -= 9;
                }
            }
            digit
        })
        .sum();

    if sum % 10 == 0 {
        Ok(())
    } else {
        Err(ValidationError::new("invalid_card_number"))
    }
}

impl From<CreatePaymentRequest> for crate::domain::payment::PaymentRequest {
    fn from(dto: CreatePaymentRequest) -> Self {
        Self {
            amount: dto.amount,
            currency: dto.currency,
            card_id: dto.card_id,
            customer_id: crate::domain::payment::CustomerId::from_uuid(dto.customer_id),
            description: dto.description,
            metadata: dto.metadata,
            idempotency_key: dto.idempotency_key,
            address_details: dto.address_details.into(),
            paying_card_details: dto.paying_card_details.into(),
        }
    }
}

impl From<AddressDetailsDto> for crate::domain::payment::AddressDetails {
    fn from(dto: AddressDetailsDto) -> Self {
        Self {
            house_number: dto.house_number,
            house_name: dto.house_name,
            address_line1: dto.address_line1,
            address_line2: dto.address_line2,
            city: dto.city,
            postcode: dto.postcode,
        }
    }
}

impl From<PayingCardDetailsDto> for crate::domain::payment::PayingCardDetails {
    fn from(dto: PayingCardDetailsDto) -> Self {
        Self {
            card_number: dto.card_number,
            expiry_month: dto.expiry_month,
            expiry_year: dto.expiry_year,
            cvv: dto.cvv,
            cardholder_name: dto.cardholder_name,
        }
    }
}
```

## Code Style and Functional Programming

### Functional Programming Patterns

Follow Rust's functional programming idioms:

```rust
use std::collections::HashMap;
use rust_decimal::Decimal;

// Good - Pure functions with immutable data
pub fn apply_discount(order: &Order, discount_percent: Decimal) -> Order {
    let discount_multiplier = (Decimal::from(100) - discount_percent) / Decimal::from(100);

    let discounted_items: Vec<OrderItem> = order
        .items
        .iter()
        .map(|item| OrderItem {
            price: item.price * discount_multiplier,
            ..item.clone()
        })
        .collect();

    let new_total_price = discounted_items
        .iter()
        .map(|item| item.price)
        .sum();

    Order {
        items: discounted_items,
        total_price: new_total_price,
        ..order.clone()
    }
}

// Good - Composition with combinators
pub fn process_order(order: Order) -> ProcessedOrder {
    order
        .pipe(validate_order)
        .and_then(apply_promotions)
        .and_then(calculate_tax)
        .and_then(assign_warehouse)
}

// Extension trait for pipeline operations
trait Pipeline<T> {
    fn pipe<U, F>(self, f: F) -> U
    where
        F: FnOnce(T) -> U;
}

impl<T> Pipeline<T> for T {
    fn pipe<U, F>(self, f: F) -> U
    where
        F: FnOnce(T) -> U,
    {
        f(self)
    }
}

// Good - Iterator usage over imperative loops
pub fn calculate_order_total(items: &[OrderItem]) -> Decimal {
    items
        .iter()
        .filter(|item| item.is_active)
        .map(|item| item.price * Decimal::from(item.quantity))
        .sum()
}

// Good - Pattern matching for state transitions
pub fn update_payment_status(
    current: PaymentStatus,
    event: PaymentEvent,
) -> Result<PaymentStatus, PaymentError> {
    use PaymentEvent::*;
    use PaymentStatus::*;

    match (current, event) {
        (Pending, Authorized) => Ok(Processing),
        (Processing, Captured) => Ok(Completed),
        (Pending | Processing, Failed(_)) => Ok(Failed),
        (status, event) => Err(PaymentError::InvalidStateTransition {
            from: status,
            to_event: event,
        }),
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum PaymentEvent {
    Authorized,
    Captured,
    Failed(String),
}
```

### Error Handling with Result and Option

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PaymentServiceError {
    #[error("Validation failed: {0}")]
    Validation(String),
    #[error("Payment not found: {id}")]
    NotFound { id: PaymentId },
    #[error("External service error: {0}")]
    ExternalService(String),
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

// Good - Comprehensive error handling with context
impl PaymentService {
    pub async fn process_payment(
        &self,
        request: PaymentRequest,
    ) -> Result<Payment, PaymentServiceError> {
        // Validate the request
        self.validate_payment_request(&request)
            .map_err(PaymentServiceError::Validation)?;

        // Check for existing payment with idempotency key
        if let Some(existing) = self.check_idempotency(&request).await? {
            return Ok(existing);
        }

        // Create payment
        let mut payment = Payment::new(
            request.amount,
            request.currency,
            request.customer_id,
            request.card_id,
        );

        // Authorize payment
        self.authorize_payment(&payment)
            .await
            .map_err(PaymentServiceError::ExternalService)?;

        // Save to database
        self.repository
            .save(&payment)
            .await
            .map_err(PaymentServiceError::Database)?;

        // Publish event
        self.event_publisher
            .publish(PaymentCreatedEvent {
                payment_id: payment.id.clone(),
                amount: payment.amount,
                currency: payment.currency.clone(),
            })
            .await
            .map_err(PaymentServiceError::ExternalService)?;

        Ok(payment)
    }

    async fn check_idempotency(
        &self,
        request: &PaymentRequest,
    ) -> Result<Option<Payment>, PaymentServiceError> {
        if let Some(key) = &request.idempotency_key {
            self.repository
                .get_by_idempotency_key(key)
                .await
                .map_err(PaymentServiceError::Database)
        } else {
            Ok(None)
        }
    }
}

// Good - Using ? operator for clean error propagation
async fn fetch_customer_data(
    customer_id: &CustomerId,
    http_client: &reqwest::Client,
) -> Result<CustomerData, Box<dyn std::error::Error + Send + Sync>> {
    let response = http_client
        .get(&format!("https://api.example.com/customers/{}", customer_id))
        .send()
        .await?;

    let customer_data: CustomerData = response
        .json()
        .await?;

    Ok(customer_data)
}
```

### Async Programming and Concurrency

```rust
use tokio::time::{sleep, Duration};
use futures::future::try_join_all;
use std::sync::Arc;

// Good - Concurrent operations when they don't depend on each other
pub async fn get_customer_summary(
    &self,
    customer_id: &CustomerId,
) -> Result<CustomerSummary, ServiceError> {
    let customer_future = self.customer_repository.get_by_id(customer_id);
    let payments_future = self.payment_repository.get_by_customer_id(customer_id);
    let orders_future = self.order_repository.get_by_customer_id(customer_id);

    let (customer, payments, orders) = tokio::try_join!(
        customer_future,
        payments_future,
        orders_future
    )?;

    let customer = customer.ok_or(ServiceError::CustomerNotFound)?;

    Ok(CustomerSummary {
        customer,
        payments,
        orders,
    })
}

// Good - Batch operations with controlled concurrency
pub async fn process_payments_batch(
    &self,
    payment_requests: Vec<PaymentRequest>,
) -> Vec<Result<Payment, PaymentServiceError>> {
    use futures::stream::{self, StreamExt};

    stream::iter(payment_requests)
        .map(|request| self.process_payment(request))
        .buffer_unordered(10) // Process up to 10 payments concurrently
        .collect()
        .await
}

// Good - Timeout and retry patterns
pub async fn call_external_service_with_retry<T, F, Fut>(
    operation: F,
    max_retries: usize,
    timeout: Duration,
) -> Result<T, ServiceError>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, ServiceError>>,
{
    let mut attempts = 0;

    loop {
        match tokio::time::timeout(timeout, operation()).await {
            Ok(Ok(result)) => return Ok(result),
            Ok(Err(e)) if attempts >= max_retries => return Err(e),
            Ok(Err(_)) => {
                attempts += 1;
                let delay = Duration::from_millis(100 * (1 << attempts)); // Exponential backoff
                sleep(delay).await;
            }
            Err(_) => {
                if attempts >= max_retries {
                    return Err(ServiceError::Timeout);
                }
                attempts += 1;
                let delay = Duration::from_millis(100 * (1 << attempts));
                sleep(delay).await;
            }
        }
    }
}

// Good - Graceful shutdown handling
pub struct PaymentProcessor {
    shutdown_sender: tokio::sync::broadcast::Sender<()>,
    tasks: Vec<tokio::task::JoinHandle<()>>,
}

impl PaymentProcessor {
    pub async fn start(&mut self) -> Result<(), ProcessorError> {
        let mut shutdown_receiver = self.shutdown_sender.subscribe();

        let task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    // Process payments
                    result = self.process_next_payment() => {
                        match result {
                            Ok(_) => continue,
                            Err(e) => {
                                tracing::error!("Payment processing error: {}", e);
                                continue;
                            }
                        }
                    }
                    // Handle shutdown signal
                    _ = shutdown_receiver.recv() => {
                        tracing::info!("Payment processor shutting down gracefully");
                        break;
                    }
                }
            }
        });

        self.tasks.push(task);
        Ok(())
    }

    pub async fn shutdown(self) -> Result<(), ProcessorError> {
        // Send shutdown signal
        let _ = self.shutdown_sender.send(());

        // Wait for all tasks to complete
        for task in self.tasks {
            if let Err(e) = task.await {
                tracing::error!("Task failed to shutdown cleanly: {}", e);
            }
        }

        Ok(())
    }
}
```

## Web Layer with Axum

### Route Handlers and Extractors

```rust
// src/web/routes/payment_routes.rs
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use crate::{
    application::payment::dto::{CreatePaymentRequest, PaymentResponse},
    domain::payment::{PaymentId, CustomerId},
    web::extractors::ValidatedJson,
    infrastructure::app_state::AppState,
};

pub fn payment_routes() -> Router<AppState> {
    Router::new()
        .route("/payments", post(create_payment))
        .route("/payments/:id", get(get_payment))
        .route("/payments", get(get_payments))
        .route("/payments/:id", delete(delete_payment))
}

#[derive(Debug, Deserialize, Validate)]
pub struct GetPaymentsQuery {
    #[validate(range(min = 1, message = "Page must be greater than 0"))]
    pub page: Option<usize>,

    #[validate(range(min = 1, max = 100, message = "Page size must be between 1 and 100"))]
    pub page_size: Option<usize>,

    pub status: Option<String>,
    pub from_date: Option<chrono::DateTime<chrono::Utc>>,
    pub to_date: Option<chrono::DateTime<chrono::Utc>>,
}

pub async fn create_payment(
    State(app_state): State<AppState>,
    ValidatedJson(request): ValidatedJson<CreatePaymentRequest>,
) -> Result<(StatusCode, Json<PaymentResponse>), ApiError> {
    let payment_request = request.into();

    let payment = app_state
        .payment_service
        .process_payment(payment_request)
        .await
        .map_err(ApiError::from)?;

    let response = PaymentResponse::from(payment);

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn get_payment(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<PaymentResponse>, ApiError> {
    let payment_id = PaymentId::from_uuid(id);

    let payment = app_state
        .payment_service
        .get_payment(&payment_id)
        .await
        .map_err(ApiError::from)?
        .ok_or(ApiError::NotFound("Payment not found".to_string()))?;

    let response = PaymentResponse::from(payment);

    Ok(Json(response))
}

pub async fn get_payments(
    State(app_state): State<AppState>,
    Query(query): Query<GetPaymentsQuery>,
) -> Result<Json<PagedResponse<PaymentResponse>>, ApiError> {
    // Validate query parameters
    query.validate().map_err(ApiError::Validation)?;

    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(20);

    let status = query.status.as_ref()
        .map(|s| s.parse::<crate::domain::payment::PaymentStatus>())
        .transpose()
        .map_err(|_| ApiError::BadRequest("Invalid status".to_string()))?;

    let payments = app_state
        .payment_service
        .get_payments_paged(page, page_size, status, query.from_date, query.to_date)
        .await
        .map_err(ApiError::from)?;

    let response = PagedResponse {
        data: payments.data.into_iter().map(PaymentResponse::from).collect(),
        page: payments.page,
        page_size: payments.page_size,
        total_count: payments.total_count,
        total_pages: payments.total_pages,
        has_next_page: payments.has_next_page(),
        has_previous_page: payments.has_previous_page(),
    };

    Ok(Json(response))
}

pub async fn delete_payment(
    State(app_state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let payment_id = PaymentId::from_uuid(id);

    app_state
        .payment_service
        .delete_payment(&payment_id)
        .await
        .map_err(ApiError::from)?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Serialize)]
pub struct PagedResponse<T> {
    pub data: Vec<T>,
    pub page: usize,
    pub page_size: usize,
    pub total_count: usize,
    pub total_pages: usize,
    pub has_next_page: bool,
    pub has_previous_page: bool,
}
```

### Custom Extractors and Validation

```rust
// src/web/extractors/validation.rs
use axum::{
    async_trait,
    extract::{FromRequest, Request},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::de::DeserializeOwned;
use validator::Validate;

use crate::web::errors::ApiError;

pub struct ValidatedJson<T>(pub T);

#[async_trait]
impl<T, S> FromRequest<S> for ValidatedJson<T>
where
    T: DeserializeOwned + Validate,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let Json(value) = Json::<T>::from_request(req, state)
            .await
            .map_err(|err| ApiError::BadRequest(format!("Invalid JSON: {}", err)))?;

        value.validate().map_err(ApiError::Validation)?;

        Ok(ValidatedJson(value))
    }
}
```

### Error Handling and Middleware

```rust
// src/web/errors.rs
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use validator::ValidationErrors;

#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    NotFound(String),
    Validation(ValidationErrors),
    InternalServerError(String),
    Unauthorized,
    Forbidden,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            ApiError::BadRequest(message) => (StatusCode::BAD_REQUEST, message),
            ApiError::NotFound(message) => (StatusCode::NOT_FOUND, message),
            ApiError::Validation(errors) => {
                let message = format_validation_errors(&errors);
                (StatusCode::BAD_REQUEST, message)
            }
            ApiError::InternalServerError(message) => {
                tracing::error!("Internal server error: {}", message);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized".to_string()),
            ApiError::Forbidden => (StatusCode::FORBIDDEN, "Forbidden".to_string()),
        };

        let body = Json(json!({
            "error": error_message,
            "status": status.as_u16()
        }));

        (status, body).into_response()
    }
}

fn format_validation_errors(errors: &ValidationErrors) -> String {
    let mut messages = Vec::new();

    for (field, field_errors) in errors.field_errors() {
        for error in field_errors {
            let message = error.message
                .as_ref()
                .map(|msg| msg.to_string())
                .unwrap_or_else(|| format!("Invalid value for field '{}'", field));
            messages.push(message);
        }
    }

    messages.join(", ")
}

impl From<crate::application::payment::PaymentServiceError> for ApiError {
    fn from(err: crate::application::payment::PaymentServiceError) -> Self {
        use crate::application::payment::PaymentServiceError;

        match err {
            PaymentServiceError::Validation(msg) => ApiError::BadRequest(msg),
            PaymentServiceError::NotFound { .. } => ApiError::NotFound("Payment not found".to_string()),
            PaymentServiceError::ExternalService(msg) => ApiError::InternalServerError(msg),
            PaymentServiceError::Database(db_err) => {
                tracing::error!("Database error: {}", db_err);
                ApiError::InternalServerError("Database error occurred".to_string())
            }
        }
    }
}

// src/web/middleware/logging.rs
use axum::{
    extract::MatchedPath,
    http::{Request, Response},
    middleware::Next,
    response::IntoResponse,
};
use std::time::Instant;
use tracing::{info_span, Instrument};
use uuid::Uuid;

pub async fn logging_middleware<B>(
    request: Request<B>,
    next: Next<B>,
) -> impl IntoResponse {
    let request_id = Uuid::new_v4();
    let start = Instant::now();

    let method = request.method().clone();
    let uri = request.uri().clone();
    let matched_path = request
        .extensions()
        .get::<MatchedPath>()
        .map(|mp| mp.as_str())
        .unwrap_or_else(|| uri.path());

    let span = info_span!(
        "http_request",
        request_id = %request_id,
        method = %method,
        path = matched_path,
        status_code = tracing::field::Empty,
        duration_ms = tracing::field::Empty,
    );

    async move {
        tracing::info!("Request started");

        let response = next.run(request).await;

        let duration = start.elapsed();
        let status_code = response.status();

        span.record("status_code", status_code.as_u16());
        span.record("duration_ms", duration.as_millis() as u64);

        tracing::info!(
            status = status_code.as_u16(),
            duration_ms = duration.as_millis(),
            "Request completed"
        );

        response
    }
    .instrument(span)
    .await
}

// src/web/middleware/auth.rs
use axum::{
    extract::Request,
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};

use crate::web::errors::ApiError;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
    pub roles: Vec<String>,
}

pub async fn auth_middleware(
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let auth_header = headers
        .get("Authorization")
        .and_then(|header| header.to_str().ok())
        .ok_or(ApiError::Unauthorized)?;

    if !auth_header.starts_with("Bearer ") {
        return Err(ApiError::Unauthorized);
    }

    let token = &auth_header[7..];

    // In a real app, get this from configuration
    let secret = std::env::var("JWT_SECRET").map_err(|_| ApiError::InternalServerError("JWT secret not configured".to_string()))?;
    let decoding_key = DecodingKey::from_secret(secret.as_ref());

    let claims = decode::<Claims>(token, &decoding_key, &Validation::new(Algorithm::HS256))
        .map_err(|_| ApiError::Unauthorized)?
        .claims;

    // Add claims to request extensions for use in handlers
    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}

// Authorization middleware for role-based access
pub async fn require_role(
    required_role: &str,
) -> impl Fn(Request, Next) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Response, ApiError>> + Send>> + Clone {
    let required_role = required_role.to_string();

    move |request: Request, next: Next| {
        let required_role = required_role.clone();

        Box::pin(async move {
            let claims = request
                .extensions()
                .get::<Claims>()
                .ok_or(ApiError::Unauthorized)?;

            if !claims.roles.contains(&required_role) && !claims.roles.contains(&"Admin".to_string()) {
                return Err(ApiError::Forbidden);
            }

            Ok(next.run(request).await)
        })
    }
}
```

## Data Access and Database with SQLx

### Repository Implementation

```rust
// src/infrastructure/persistence/payment_repository.rs
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::domain::payment::{
    Payment, PaymentId, CustomerId, PaymentStatus, PaymentRepository, PagedResult, Error
};

#[derive(Clone)]
pub struct SqlxPaymentRepository {
    pool: PgPool,
}

impl SqlxPaymentRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PaymentRepository for SqlxPaymentRepository {
    async fn get_by_id(&self, id: &PaymentId) -> Result<Option<Payment>, Error> {
        let payment = sqlx::query_as!(
            PaymentRow,
            r#"
            SELECT
                id,
                amount,
                currency,
                customer_id,
                card_id,
                status as "status: PaymentStatus",
                description,
                metadata,
                created_at,
                processed_at
            FROM payments
            WHERE id = $1 AND deleted_at IS NULL
            "#,
            id.inner()
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| Error::DatabaseError(e.to_string()))?;

        Ok(payment.map(|row| row.into()))
    }

    async fn get_by_customer_id(&self, customer_id: &CustomerId) -> Result<Vec<Payment>, Error> {
        let payments = sqlx::query_as!(
            PaymentRow,
            r#"
            SELECT
                id,
                amount,
                currency,
                customer_id,
                card_id,
                status as "status: PaymentStatus",
                description,
                metadata,
                created_at,
                processed_at
            FROM payments
            WHERE customer_id = $1 AND deleted_at IS NULL
            ORDER BY created_at DESC
            "#,
            customer_id.inner()
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::DatabaseError(e.to_string()))?;

        Ok(payments.into_iter().map(|row| row.into()).collect())
    }

    async fn get_paged(
        &self,
        page: usize,
        page_size: usize,
        status: Option<PaymentStatus>,
        from_date: Option<DateTime<Utc>>,
        to_date: Option<DateTime<Utc>>,
    ) -> Result<PagedResult<Payment>, Error> {
        let offset = (page - 1) * page_size;
        let limit = page_size as i64;

        // Build dynamic query based on filters
        let mut conditions = vec!["deleted_at IS NULL"];
        let mut params: Vec<Box<dyn sqlx::types::Type<sqlx::Postgres> + Send + Sync>> = vec![];
        let mut param_count = 0;

        if status.is_some() {
            param_count += 1;
            conditions.push(&format!("status = ${}", param_count));
        }

        if from_date.is_some() {
            param_count += 1;
            conditions.push(&format!("created_at >= ${}", param_count));
        }

        if to_date.is_some() {
            param_count += 1;
            conditions.push(&format!("created_at <= ${}", param_count));
        }

        let where_clause = conditions.join(" AND ");

        // Get total count
        let count_query = format!(
            "SELECT COUNT(*) FROM payments WHERE {}",
            where_clause
        );

        let mut count_query_builder = sqlx::query_scalar::<_, i64>(&count_query);

        if let Some(status) = &status {
            count_query_builder = count_query_builder.bind(status);
        }
        if let Some(from_date) = from_date {
            count_query_builder = count_query_builder.bind(from_date);
        }
        if let Some(to_date) = to_date {
            count_query_builder = count_query_builder.bind(to_date);
        }

        let total_count = count_query_builder
            .fetch_one(&self.pool)
            .await
            .map_err(|e| Error::DatabaseError(e.to_string()))? as usize;

        // Get paginated results
        let data_query = format!(
            r#"
            SELECT
                id,
                amount,
                currency,
                customer_id,
                card_id,
                status as "status: PaymentStatus",
                description,
                metadata,
                created_at,
                processed_at
            FROM payments
            WHERE {}
            ORDER BY created_at DESC
            LIMIT ${} OFFSET ${}
            "#,
            where_clause,
            param_count + 1,
            param_count + 2
        );

        let mut data_query_builder = sqlx::query_as::<_, PaymentRow>(&data_query);

        if let Some(status) = &status {
            data_query_builder = data_query_builder.bind(status);
        }
        if let Some(from_date) = from_date {
            data_query_builder = data_query_builder.bind(from_date);
        }
        if let Some(to_date) = to_date {
            data_query_builder = data_query_builder.bind(to_date);
        }

        data_query_builder = data_query_builder.bind(limit).bind(offset as i64);

        let payments = data_query_builder
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Error::DatabaseError(e.to_string()))?;

        let data: Vec<Payment> = payments.into_iter().map(|row| row.into()).collect();

        Ok(PagedResult::new(data, page, page_size, total_count))
    }

    async fn save(&self, payment: &Payment) -> Result<(), Error> {
        sqlx::query!(
            r#"
            INSERT INTO payments (
                id, amount, currency, customer_id, card_id, status,
                description, metadata, created_at, processed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
                amount = EXCLUDED.amount,
                currency = EXCLUDED.currency,
                customer_id = EXCLUDED.customer_id,
                card_id = EXCLUDED.card_id,
                status = EXCLUDED.status,
                description = EXCLUDED.description,
                metadata = EXCLUDED.metadata,
                processed_at = EXCLUDED.processed_at,
                updated_at = NOW()
            "#,
            payment.id.inner(),
            payment.amount,
            payment.currency,
            payment.customer_id.inner(),
            payment.card_id,
            payment.status as PaymentStatus,
            payment.description,
            payment.metadata.as_ref().map(|m| serde_json::to_value(m).unwrap()),
            payment.created_at,
            payment.processed_at,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn delete(&self, id: &PaymentId) -> Result<(), Error> {
        let affected_rows = sqlx::query!(
            "UPDATE payments SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
            id.inner()
        )
        .execute(&self.pool)
        .await
        .map_err(|e| Error::DatabaseError(e.to_string()))?
        .rows_affected();

        if affected_rows == 0 {
            Err(Error::NotFound { id: id.clone() })
        } else {
            Ok(())
        }
    }

    async fn exists(&self, id: &PaymentId) -> Result<bool, Error> {
        let exists = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM payments WHERE id = $1 AND deleted_at IS NULL)",
            id.inner()
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Error::DatabaseError(e.to_string()))?
        .unwrap_or(false);

        Ok(exists)
    }

    async fn get_total_amount_by_customer(
        &self,
        customer_id: &CustomerId,
        from_date: DateTime<Utc>,
        to_date: DateTime<Utc>,
    ) -> Result<rust_decimal::Decimal, Error> {
        let total = sqlx::query_scalar!(
            r#"
            SELECT COALESCE(SUM(amount), 0) as total
            FROM payments
            WHERE customer_id = $1
                AND created_at BETWEEN $2 AND $3
                AND status = 'Completed'
                AND deleted_at IS NULL
            "#,
            customer_id.inner(),
            from_date,
            to_date
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Error::DatabaseError(e.to_string()))?
        .unwrap_or_else(|| rust_decimal::Decimal::ZERO);

        Ok(total)
    }
}

// Database row type for SQLx
#[derive(Debug, sqlx::FromRow)]
struct PaymentRow {
    id: Uuid,
    amount: rust_decimal::Decimal,
    currency: String,
    customer_id: Uuid,
    card_id: String,
    status: PaymentStatus,
    description: Option<String>,
    metadata: Option<serde_json::Value>,
    created_at: DateTime<Utc>,
    processed_at: Option<DateTime<Utc>>,
}

impl From<PaymentRow> for Payment {
    fn from(row: PaymentRow) -> Self {
        Self {
            id: PaymentId::from_uuid(row.id),
            amount: row.amount,
            currency: row.currency,
            customer_id: CustomerId::from_uuid(row.customer_id),
            card_id: row.card_id,
            status: row.status,
            description: row.description,
            metadata: row.metadata.and_then(|v| serde_json::from_value(v).ok()),
            created_at: row.created_at,
            processed_at: row.processed_at,
        }
    }
}
```

### Database Migrations

```sql
-- migrations/001_create_payments_table.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE payment_status AS ENUM ('Pending', 'Processing', 'Completed', 'Failed', 'Cancelled');

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amount DECIMAL(18, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL,
    customer_id UUID NOT NULL,
    card_id VARCHAR(50) NOT NULL,
    status payment_status NOT NULL DEFAULT 'Pending',
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_payments_customer_id ON payments (customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_status ON payments (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_created_at ON payments (created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_customer_created ON payments (customer_id, created_at) WHERE deleted_at IS NULL;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

## TDD Process - THE FUNDAMENTAL PRACTICE

**CRITICAL**: TDD is not optional. Every feature, every bug fix, every change MUST follow this process:

Follow Red-Green-Refactor strictly:

1. **Red**: Write a failing test for the desired behavior. NO PRODUCTION CODE until you have a failing test.
2. **Green**: Write the MINIMUM code to make the test pass. Resist the urge to write more than needed.
3. **Refactor**: Assess the code for improvement opportunities. If refactoring would add value, clean up the code while keeping tests green. If the code is already clean and expressive, move on.

#### TDD Example Workflow

```rust
// Step 1: Red - Start with the simplest behavior
#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;
    use crate::tests::common::test_builders::*;

    #[tokio::test]
    async fn process_order_should_calculate_total_with_shipping_cost() {
        // Arrange
        let order = OrderBuilder::new()
            .with_items(vec![OrderItem::new(dec!(30.00), 1)])
            .with_shipping_cost(dec!(5.99))
            .build();

        // Act
        let processed = process_order(order).await;

        // Assert
        assert_eq!(processed.total, dec!(35.99));
        assert_eq!(processed.shipping_cost, dec!(5.99));
    }
}

// Step 2: Green - Minimal implementation
pub async fn process_order(order: Order) -> ProcessedOrder {
    let items_total = order.items.iter()
        .map(|item| item.price * rust_decimal::Decimal::from(item.quantity))
        .sum::<rust_decimal::Decimal>();

    ProcessedOrder {
        items: order.items,
        shipping_cost: order.shipping_cost,
        total: items_total + order.shipping_cost,
    }
}

// Step 3: Red - Add test for free shipping behavior
#[tokio::test]
async fn process_order_should_apply_free_shipping_for_orders_over_50() {
    // Arrange
    let order = OrderBuilder::new()
        .with_items(vec![OrderItem::new(dec!(60.00), 1)])
        .with_shipping_cost(dec!(5.99))
        .build();

    // Act
    let processed = process_order(order).await;

    // Assert
    assert_eq!(processed.shipping_cost, dec!(0.00));
    assert_eq!(processed.total, dec!(60.00));
}

// Step 4: Green - NOW we can add the conditional because both paths are tested
pub async fn process_order(order: Order) -> ProcessedOrder {
    let items_total = order.items.iter()
        .map(|item| item.price * rust_decimal::Decimal::from(item.quantity))
        .sum::<rust_decimal::Decimal>();

    let shipping_cost = if items_total > dec!(50.00) {
        dec!(0.00)
    } else {
        order.shipping_cost
    };

    ProcessedOrder {
        items: order.items,
        shipping_cost,
        total: items_total + shipping_cost,
    }
}

// Step 5: Refactor - Extract constants and improve readability
const FREE_SHIPPING_THRESHOLD: rust_decimal::Decimal = dec!(50.00);

fn calculate_items_total(items: &[OrderItem]) -> rust_decimal::Decimal {
    items.iter()
        .map(|item| item.price * rust_decimal::Decimal::from(item.quantity))
        .sum()
}

fn qualifies_for_free_shipping(items_total: rust_decimal::Decimal) -> bool {
    items_total > FREE_SHIPPING_THRESHOLD
}

pub async fn process_order(order: Order) -> ProcessedOrder {
    let items_total = calculate_items_total(&order.items);
    let shipping_cost = if qualifies_for_free_shipping(items_total) {
        dec!(0.00)
    } else {
        order.shipping_cost
    };

    ProcessedOrder {
        items: order.items,
        shipping_cost,
        total: items_total + shipping_cost,
    }
}
```

### Integration Testing with Testcontainers

```rust
// tests/integration/payment_integration_tests.rs
use testcontainers::{clients::Cli, core::WaitFor, images::postgres::Postgres, Container};
use sqlx::{PgPool, Row};
use tokio;
use uuid::Uuid;

use payment_service::{
    application::payment::PaymentService,
    domain::payment::{PaymentRepository, CustomerId},
    infrastructure::{
        persistence::SqlxPaymentRepository,
        config::DatabaseConfig,
    },
    tests::common::test_builders::*,
};

struct TestContext {
    db_pool: PgPool,
    payment_service: PaymentService,
    _container: Container<'static, Postgres>,
}

impl TestContext {
    async fn new() -> Self {
        let docker = Cli::default();
        let postgres_image = Postgres::default()
            .with_db_name("test_payments")
            .with_user("test_user")
            .with_password("test_password");

        let container = docker.run(postgres_image);
        let connection_string = format!(
            "postgres://test_user:test_password@127.0.0.1:{}/test_payments",
            container.get_host_port_ipv4(5432)
        );

        let db_pool = PgPool::connect(&connection_string)
            .await
            .expect("Failed to connect to test database");

        // Run migrations
        sqlx::migrate!("./migrations")
            .run(&db_pool)
            .await
            .expect("Failed to run migrations");

        let payment_repository = SqlxPaymentRepository::new(db_pool.clone());
        let payment_service = PaymentService::new(
            Arc::new(payment_repository),
            // Add other dependencies as needed
        );

        Self {
            db_pool,
            payment_service,
            _container: container,
        }
    }

    async fn cleanup(&self) {
        sqlx::query("TRUNCATE TABLE payments CASCADE")
            .execute(&self.db_pool)
            .await
            .expect("Failed to clean up test data");
    }
}

#[tokio::test]
async fn create_payment_should_store_in_database() {
    // Arrange
    let ctx = TestContext::new().await;
    let customer_id = CustomerId::new();

    let payment_request = PaymentRequestBuilder::new()
        .with_amount(dec!(150.00))
        .with_currency("GBP")
        .with_customer_id(customer_id.inner())
        .build();

    // Act
    let result = ctx.payment_service
        .process_payment(payment_request.into())
        .await;

    // Assert
    assert!(result.is_ok());
    let payment = result.unwrap();

    // Verify payment was stored in database
    let stored_payment = ctx.payment_service
        .get_payment(&payment.id)
        .await
        .expect("Failed to retrieve payment")
        .expect("Payment not found");

    assert_eq!(stored_payment.id, payment.id);
    assert_eq!(stored_payment.amount, dec!(150.00));
    assert_eq!(stored_payment.currency, "GBP");
    assert_eq!(stored_payment.customer_id, customer_id);

    ctx.cleanup().await;
}

#[tokio::test]
async fn get_payments_paged_should_return_correct_pagination() {
    // Arrange
    let ctx = TestContext::new().await;
    let customer_id = CustomerId::new();

    // Create 5 test payments
    for i in 1..=5 {
        let payment_request = PaymentRequestBuilder::new()
            .with_amount(dec!(100) * rust_decimal::Decimal::from(i))
            .with_customer_id(customer_id.inner())
            .build();

        ctx.payment_service
            .process_payment(payment_request.into())
            .await
            .expect("Failed to create test payment");
    }

    // Act - Get first page with 2 items
    let page1 = ctx.payment_service
        .get_payments_paged(1, 2, None, None, None)
        .await
        .expect("Failed to get payments page 1");

    // Act - Get second page with 2 items
    let page2 = ctx.payment_service
        .get_payments_paged(2, 2, None, None, None)
        .await
        .expect("Failed to get payments page 2");

    // Assert
    assert_eq!(page1.data.len(), 2);
    assert_eq!(page1.total_count, 5);
    assert_eq!(page1.total_pages, 3);
    assert!(page1.has_next_page());
    assert!(!page1.has_previous_page());

    assert_eq!(page2.data.len(), 2);
    assert_eq!(page2.total_count, 5);
    assert_eq!(page2.total_pages, 3);
    assert!(page2.has_next_page());
    assert!(page2.has_previous_page());

    ctx.cleanup().await;
}

// Property-based testing with proptest
#[cfg(test)]
mod property_tests {
    use super::*;
    use proptest::prelude::*;
    use rust_decimal::Decimal;

    proptest! {
        #[test]
        fn payment_amount_calculation_is_consistent(
            amount in 1.0f64..10000.0f64,
            shipping in 0.0f64..100.0f64
        ) {
            let amount_decimal = Decimal::try_from(amount).unwrap();
            let shipping_decimal = Decimal::try_from(shipping).unwrap();

            let order = OrderBuilder::new()
                .with_items(vec![OrderItem::new(amount_decimal, 1)])
                .with_shipping_cost(shipping_decimal)
                .build();

            tokio_test::block_on(async {
                let processed = process_order(order).await;

                if amount >= 50.0 {
                    prop_assert_eq!(processed.shipping_cost, Decimal::ZERO);
                    prop_assert_eq!(processed.total, amount_decimal);
                } else {
                    prop_assert_eq!(processed.shipping_cost, shipping_decimal);
                    prop_assert_eq!(processed.total, amount_decimal + shipping_decimal);
                }
            });
        }
    }
}
```

## Configuration and Application Setup

### Configuration Management

```rust
// src/infrastructure/config/settings.rs
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub database: DatabaseConfig,
    pub server: ServerConfig,
    pub payment_gateway: PaymentGatewayConfig,
    pub logging: LoggingConfig,
    pub jwt: JwtConfig,
    pub redis: RedisConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub acquire_timeout_seconds: u64,
    pub idle_timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub cors_origins: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentGatewayConfig {
    pub base_url: String,
    pub api_key: String,
    pub timeout_seconds: u64,
    pub max_retries: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtConfig {
    pub secret: String,
    pub expiration_hours: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedisConfig {
    pub url: String,
    pub max_connections: u32,
}

impl Settings {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        let mut builder = config::Config::builder()
            .add_source(config::File::with_name("config/default"))
            .add_source(config::Environment::with_prefix("APP"));

        // Add environment-specific config if specified
        if let Ok(env) = env::var("APP_ENVIRONMENT") {
            builder = builder.add_source(config::File::with_name(&format!("config/{}", env)).required(false));
        }

        builder.build()?.try_deserialize()
    }
}

// Default configuration for development
impl Default for Settings {
    fn default() -> Self {
        Self {
            database: DatabaseConfig {
                url: "postgres://postgres:password@localhost:5432/payments_dev".to_string(),
                max_connections: 10,
                min_connections: 1,
                acquire_timeout_seconds: 30,
                idle_timeout_seconds: 600,
            },
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 3000,
                cors_origins: vec!["http://localhost:3000".to_string()],
            },
            payment_gateway: PaymentGatewayConfig {
                base_url: "https://api.payment-gateway.example.com".to_string(),
                api_key: "dev-api-key".to_string(),
                timeout_seconds: 30,
                max_retries: 3,
            },
            logging: LoggingConfig {
                level: "info".to_string(),
                format: "json".to_string(),
            },
            jwt: JwtConfig {
                secret: "dev-secret-key".to_string(),
                expiration_hours: 24,
            },
            redis: RedisConfig {
                url: "redis://localhost:6379".to_string(),
                max_connections: 10,
            },
        }
    }
}
```

### Application State and Dependency Injection

```rust
// src/infrastructure/app_state.rs
use std::sync::Arc;
use sqlx::PgPool;
use redis::aio::ConnectionManager;

use crate::{
    application::payment::PaymentService,
    domain::payment::PaymentRepository,
    infrastructure::{
        persistence::SqlxPaymentRepository,
        http::PaymentGatewayClient,
        config::Settings,
    },
};

#[derive(Clone)]
pub struct AppState {
    pub payment_service: Arc<PaymentService>,
    pub db_pool: PgPool,
    pub redis: ConnectionManager,
    pub settings: Settings,
}

impl AppState {
    pub async fn new(settings: Settings) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // Database connection
        let db_pool = create_database_pool(&settings.database).await?;

        // Redis connection
        let redis = create_redis_connection(&settings.redis).await?;

        // HTTP client for payment gateway
        let http_client = create_http_client(&settings.payment_gateway)?;
        let payment_gateway = PaymentGatewayClient::new(http_client, settings.payment_gateway.clone());

        // Repository
        let payment_repository: Arc<dyn PaymentRepository> =
            Arc::new(SqlxPaymentRepository::new(db_pool.clone()));

        // Services
        let payment_service = Arc::new(PaymentService::new(
            payment_repository,
            Arc::new(payment_gateway),
        ));

        Ok(Self {
            payment_service,
            db_pool,
            redis,
            settings,
        })
    }
}

async fn create_database_pool(config: &DatabaseConfig) -> Result<PgPool, sqlx::Error> {
    sqlx::postgres::PgPoolOptions::new()
        .max_connections(config.max_connections)
        .min_connections(config.min_connections)
        .acquire_timeout(std::time::Duration::from_secs(config.acquire_timeout_seconds))
        .idle_timeout(std::time::Duration::from_secs(config.idle_timeout_seconds))
        .connect(&config.url)
        .await
}

async fn create_redis_connection(
    config: &RedisConfig,
) -> Result<ConnectionManager, redis::RedisError> {
    let client = redis::Client::open(config.url.as_str())?;
    ConnectionManager::new(client).await
}

fn create_http_client(
    config: &PaymentGatewayConfig,
) -> Result<reqwest::Client, reqwest::Error> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(config.timeout_seconds))
        .build()
}
```

### Main Application Entry Point

```rust
// src/main.rs
use axum::{
    middleware,
    Router,
};
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
    timeout::TimeoutLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use std::time::Duration;

use payment_service::{
    infrastructure::{
        app_state::AppState,
        config::Settings,
    },
    web::{
        routes::payment_routes,
        middleware::{logging_middleware, auth_middleware},
    },
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Initialize tracing
    init_tracing();

    // Load configuration
    let settings = Settings::from_env()
        .unwrap_or_else(|_| {
            tracing::warn!("Failed to load configuration from environment, using defaults");
            Settings::default()
        });

    // Create application state
    let app_state = AppState::new(settings.clone()).await?;

    // Run database migrations
    run_migrations(&app_state.db_pool).await?;

    // Build application router
    let app = build_router(app_state.clone());

    // Start server
    let listener = tokio::net::TcpListener::bind(format!("{}:{}", settings.server.host, settings.server.port))
        .await?;

    tracing::info!(
        "Server starting on {}:{}",
        settings.server.host,
        settings.server.port
    );

    axum::serve(listener, app).await?;

    Ok(())
}

fn init_tracing() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "payment_service=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();
}

async fn run_migrations(pool: &sqlx::PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    tracing::info!("Running database migrations");
    sqlx::migrate!("./migrations").run(pool).await?;
    tracing::info!("Database migrations completed successfully");
    Ok(())
}

fn build_router(app_state: AppState) -> Router {
    Router::new()
        .nest("/api/v1", payment_routes())
        .layer(
            ServiceBuilder::new()
                .layer(TimeoutLayer::new(Duration::from_secs(30)))
                .layer(TraceLayer::new_for_http())
                .layer(middleware::from_fn(logging_middleware))
                .layer(middleware::from_fn(auth_middleware))
                .layer(
                    CorsLayer::new()
                        .allow_origin(Any)
                        .allow_methods(Any)
                        .allow_headers(Any),
                )
        )
        .with_state(app_state)
}
```

## Performance and Optimization

### Memory Management and Resource Disposal

```rust
// Good - Proper resource management with RAII
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct PaymentProcessor {
    db_pool: sqlx::PgPool,
    redis_pool: deadpool_redis::Pool,
    http_client: reqwest::Client,
    shutdown_tx: tokio::sync::broadcast::Sender<()>,
    tasks: Arc<Mutex<Vec<tokio::task::JoinHandle<()>>>>,
}

impl PaymentProcessor {
    pub fn new(
        db_pool: sqlx::PgPool,
        redis_pool: deadpool_redis::Pool,
        http_client: reqwest::Client,
    ) -> Self {
        let (shutdown_tx, _) = tokio::sync::broadcast::channel(1);

        Self {
            db_pool,
            redis_pool,
            http_client,
            shutdown_tx,
            tasks: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub async fn start(&self) -> Result<(), ProcessorError> {
        let mut shutdown_rx = self.shutdown_tx.subscribe();
        let db_pool = self.db_pool.clone();
        let redis_pool = self.redis_pool.clone();

        let task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    // Process payments
                    result = Self::process_next_payment(&db_pool, &redis_pool) => {
                        match result {
                            Ok(_) => continue,
                            Err(e) => {
                                tracing::error!("Payment processing error: {}", e);
                                continue;
                            }
                        }
                    }
                    // Handle shutdown signal
                    _ = shutdown_rx.recv() => {
                        tracing::info!("Payment processor shutting down gracefully");
                        break;
                    }
                }
            }
        });

        self.tasks.lock().await.push(task);
        Ok(())
    }

    pub async fn shutdown(self) -> Result<(), ProcessorError> {
        // Send shutdown signal
        let _ = self.shutdown_tx.send(());

        // Wait for all tasks to complete
        let tasks = {
            let mut tasks_guard = self.tasks.lock().await;
            std::mem::take(tasks_guard.as_mut())
        };

        for task in tasks {
            if let Err(e) = task.await {
                tracing::error!("Task failed to shutdown cleanly: {}", e);
            }
        }

        Ok(())
    }
}

// Good - Using Arc for shared ownership, avoiding unnecessary clones
pub struct PaymentService {
    repository: Arc<dyn PaymentRepository>,
    gateway: Arc<dyn PaymentGateway>,
    cache: Arc<dyn CacheService>,
}

impl PaymentService {
    pub fn new(
        repository: Arc<dyn PaymentRepository>,
        gateway: Arc<dyn PaymentGateway>,
        cache: Arc<dyn CacheService>,
    ) -> Self {
        Self {
            repository,
            gateway,
            cache,
        }
    }

    // Methods use &self, sharing the Arc references
    pub async fn process_payment(&self, request: PaymentRequest) -> Result<Payment, ServiceError> {
        // Repository, gateway, and cache are already behind Arc, no cloning needed
        let existing = self.cache.get(&request.idempotency_key).await?;
        if let Some(payment) = existing {
            return Ok(payment);
        }

        let payment = self.repository.save(request.into()).await?;
        self.gateway.process(&payment).await?;
        self.cache.set(&request.idempotency_key, &payment).await?;

        Ok(payment)
    }
}

// Good - Zero-copy string operations where possible
use std::borrow::Cow;

pub fn mask_card_number(card_number: &str) -> Result<String, ValidationError> {
    if card_number.len() != 16 {
        return Err(ValidationError::InvalidLength);
    }

    // Using Cow to avoid allocation when possible
    let masked = format!(
        "{}****{}",
        &card_number[..4],
        &card_number[12..]
    );

    Ok(masked)
}

// For high-performance scenarios, use stack allocation
pub fn format_currency_stack(amount: rust_decimal::Decimal, currency: &str) -> heapless::String<32> {
    use heapless::String;
    use core::fmt::Write;

    let mut buffer = String::new();
    write!(&mut buffer, "{} {}", amount, currency).unwrap();
    buffer
}
```

### Caching Strategies

```rust
// Good - Multi-level caching with proper error handling
use redis::aio::ConnectionManager;
use std::time::Duration;

#[async_trait::async_trait]
pub trait CacheService: Send + Sync {
    async fn get<T>(&self, key: &str) -> Result<Option<T>, CacheError>
    where
        T: serde::de::DeserializeOwned;

    async fn set<T>(&self, key: &str, value: &T, ttl: Duration) -> Result<(), CacheError>
    where
        T: serde::Serialize;

    async fn invalidate(&self, key: &str) -> Result<(), CacheError>;
}

pub struct RedisCacheService {
    connection: ConnectionManager,
}

impl RedisCacheService {
    pub fn new(connection: ConnectionManager) -> Self {
        Self { connection }
    }
}

#[async_trait::async_trait]
impl CacheService for RedisCacheService {
    async fn get<T>(&self, key: &str) -> Result<Option<T>, CacheError>
    where
        T: serde::de::DeserializeOwned,
    {
        use redis::AsyncCommands;

        let mut conn = self.connection.clone();

        match conn.get::<_, Option<String>>(key).await {
            Ok(Some(data)) => {
                match serde_json::from_str(&data) {
                    Ok(value) => Ok(Some(value)),
                    Err(e) => {
                        tracing::warn!("Failed to deserialize cached value for key {}: {}", key, e);
                        // Invalidate corrupted cache entry
                        let _ = self.invalidate(key).await;
                        Ok(None)
                    }
                }
            }
            Ok(None) => Ok(None),
            Err(e) => {
                tracing::error!("Redis get error for key {}: {}", key, e);
                Err(CacheError::Redis(e))
            }
        }
    }

    async fn set<T>(&self, key: &str, value: &T, ttl: Duration) -> Result<(), CacheError>
    where
        T: serde::Serialize,
    {
        use redis::AsyncCommands;

        let serialized = serde_json::to_string(value)
            .map_err(CacheError::Serialization)?;

        let mut conn = self.connection.clone();

        conn.set_ex(key, serialized, ttl.as_secs())
            .await
            .map_err(CacheError::Redis)
    }

    async fn invalidate(&self, key: &str) -> Result<(), CacheError> {
        use redis::AsyncCommands;

        let mut conn = self.connection.clone();
        conn.del(key).await.map_err(CacheError::Redis)?;
        Ok(())
    }
}

// Cache-aside pattern with automatic fallback
pub struct CachedPaymentService {
    inner: PaymentService,
    cache: Arc<dyn CacheService>,
}

impl CachedPaymentService {
    pub fn new(inner: PaymentService, cache: Arc<dyn CacheService>) -> Self {
        Self { inner, cache }
    }

    pub async fn get_payment(&self, id: &PaymentId) -> Result<Option<Payment>, ServiceError> {
        let cache_key = format!("payment:{}", id);

        // Try cache first
        match self.cache.get::<Payment>(&cache_key).await {
            Ok(Some(payment)) => {
                tracing::debug!("Cache hit for payment {}", id);
                return Ok(Some(payment));
            }
            Ok(None) => {
                tracing::debug!("Cache miss for payment {}", id);
            }
            Err(e) => {
                tracing::warn!("Cache error for payment {}: {}, falling back to database", id, e);
            }
        }

        // Fallback to database
        let payment = self.inner.get_payment(id).await?;

        // Cache the result if found
        if let Some(ref payment) = payment {
            let cache_ttl = Duration::from_secs(300); // 5 minutes
            if let Err(e) = self.cache.set(&cache_key, payment, cache_ttl).await {
                tracing::warn!("Failed to cache payment {}: {}", id, e);
                // Don't fail the request due to cache errors
            }
        }

        Ok(payment)
    }

    pub async fn invalidate_payment_cache(&self, id: &PaymentId) -> Result<(), ServiceError> {
        let cache_key = format!("payment:{}", id);
        self.cache.invalidate(&cache_key).await
            .map_err(|e| ServiceError::Cache(e.to_string()))?;
        Ok(())
    }
}
```

## Security Best Practices

### Input Validation and Sanitization

```rust
// Good - Comprehensive input validation
use validator::{Validate, ValidationError};
use regex::Regex;

lazy_static::lazy_static! {
    static ref CARD_NUMBER_REGEX: Regex = Regex::new(r"^\d{16}$").unwrap();
    static ref UK_POSTCODE_REGEX: Regex = Regex::new(r"^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$").unwrap();
    static ref EMAIL_REGEX: Regex = Regex::new(
        r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    ).unwrap();
}

#[derive(Debug, Clone, Validate)]
pub struct CreateCustomerRequest {
    #[validate(regex = "EMAIL_REGEX", message = "Invalid email format")]
    #[validate(length(max = 320, message = "Email too long"))]
    pub email: String,

    #[validate(length(min = 1, max = 100, message = "First name must be 1-100 characters"))]
    #[validate(custom = "validate_name")]
    pub first_name: String,

    #[validate(length(min = 1, max = 100, message = "Last name must be 1-100 characters"))]
    #[validate(custom = "validate_name")]
    pub last_name: String,

    #[validate(custom = "validate_phone_number")]
    pub phone_number: Option<String>,

    #[validate(custom = "validate_date_of_birth")]
    pub date_of_birth: chrono::NaiveDate,
}

fn validate_name(name: &str) -> Result<(), ValidationError> {
    // Only allow letters, spaces, hyphens, apostrophes, and periods
    let name_regex = Regex::new(r"^[a-zA-Z\s\-'\.]+$").unwrap();

    if name_regex.is_match(name) {
        Ok(())
    } else {
        Err(ValidationError::new("invalid_name_format"))
    }
}

fn validate_phone_number(phone: &Option<String>) -> Result<(), ValidationError> {
    if let Some(phone_str) = phone {
        // International phone number format
        let phone_regex = Regex::new(r"^\+?[1-9]\d{1,14}$").unwrap();

        if phone_regex.is_match(phone_str) {
            Ok(())
        } else {
            Err(ValidationError::new("invalid_phone_format"))
        }
    } else {
        Ok(())
    }
}

fn validate_date_of_birth(dob: &chrono::NaiveDate) -> Result<(), ValidationError> {
    let today = chrono::Utc::now().date_naive();
    let min_age = today - chrono::Duration::days(365 * 18); // 18 years ago
    let max_age = today - chrono::Duration::days(365 * 120); // 120 years ago

    if *dob <= min_age && *dob >= max_age {
        Ok(())
    } else {
        Err(ValidationError::new("invalid_age"))
    }
}

// SQL injection prevention with SQLx compile-time checking
impl SqlxPaymentRepository {
    pub async fn search_payments_safe(
        &self,
        card_last4: Option<&str>,
        customer_email: Option<&str>,
    ) -> Result<Vec<Payment>, Error> {
        // SQLx automatically parameterizes and validates queries at compile time
        let payments = sqlx::query_as!(
            PaymentRow,
            r#"
            SELECT
                id, amount, currency, customer_id, card_id,
                status as "status: PaymentStatus",
                description, metadata, created_at, processed_at
            FROM payments p
            LEFT JOIN customers c ON p.customer_id = c.id
            WHERE
                ($1::TEXT IS NULL OR RIGHT(p.card_id, 4) = $1)
                AND ($2::TEXT IS NULL OR c.email = $2)
                AND p.deleted_at IS NULL
            ORDER BY p.created_at DESC
            "#,
            card_last4,
            customer_email
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Error::DatabaseError(e.to_string()))?;

        Ok(payments.into_iter().map(|row| row.into()).collect())
    }
}

// HTML encoding for safe output
use html_escape::{encode_safe, encode_text};

pub struct PaymentReportService;

impl PaymentReportService {
    pub async fn generate_html_report(payments: &[Payment]) -> String {
        let mut html = String::new();
        html.push_str("<html><body>");
        html.push_str("<h1>Payment Report</h1>");
        html.push_str("<table>");
        html.push_str("<tr><th>ID</th><th>Amount</th><th>Customer</th><th>Status</th></tr>");

        for payment in payments {
            html.push_str("<tr>");
            html.push_str(&format!("<td>{}</td>", encode_text(&payment.id.to_string())));
            html.push_str(&format!("<td>{}</td>", encode_text(&format!("{} {}", payment.amount, payment.currency))));
            html.push_str(&format!("<td>{}</td>", encode_text(&payment.customer_id.to_string())));
            html.push_str(&format!("<td>{}</td>", encode_text(&format!("{:?}", payment.status))));
            html.push_str("</tr>");
        }

        html.push_str("</table>");
        html.push_str("</body></html>");
        html
    }
}
```

### Authentication and Authorization

```rust
// JWT authentication and authorization
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use chrono::{Duration, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,    // Subject (user ID)
    pub email: String,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    pub exp: i64,       // Expiration time
    pub iat: i64,       // Issued at
    pub nbf: i64,       // Not before
}

impl Claims {
    pub fn new(
        user_id: String,
        email: String,
        roles: Vec<String>,
        permissions: Vec<String>,
        expiration_hours: i64,
    ) -> Self {
        let now = Utc::now();
        let exp = now + Duration::hours(expiration_hours);

        Self {
            sub: user_id,
            email,
            roles,
            permissions,
            exp: exp.timestamp(),
            iat: now.timestamp(),
            nbf: now.timestamp(),
        }
    }

    pub fn has_role(&self, role: &str) -> bool {
        self.roles.contains(&role.to_string()) || self.roles.contains(&"Admin".to_string())
    }

    pub fn has_permission(&self, permission: &str) -> bool {
        self.permissions.contains(&permission.to_string()) || self.has_role("Admin")
    }

    pub fn is_expired(&self) -> bool {
        Utc::now().timestamp() > self.exp
    }
}

pub struct JwtService {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    validation: Validation,
}

impl JwtService {
    pub fn new(secret: &str) -> Self {
        let encoding_key = EncodingKey::from_secret(secret.as_ref());
        let decoding_key = DecodingKey::from_secret(secret.as_ref());
        let validation = Validation::new(Algorithm::HS256);

        Self {
            encoding_key,
            decoding_key,
            validation,
        }
    }

    pub fn create_token(&self, claims: &Claims) -> Result<String, jsonwebtoken::errors::Error> {
        encode(&Header::default(), claims, &self.encoding_key)
    }

    pub fn validate_token(&self, token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
        let token_data = decode::<Claims>(token, &self.decoding_key, &self.validation)?;

        if token_data.claims.is_expired() {
            return Err(jsonwebtoken::errors::Error::from(jsonwebtoken::errors::ErrorKind::ExpiredSignature));
        }

        Ok(token_data.claims)
    }
}

// Authorization middleware
use axum::extract::Request;

pub async fn require_permission(
    permission: &'static str,
) -> impl Fn(Request, Next) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Response, ApiError>> + Send>> + Clone {
    move |request: Request, next: Next| {
        Box::pin(async move {
            let claims = request
                .extensions()
                .get::<Claims>()
                .ok_or(ApiError::Unauthorized)?;

            if !claims.has_permission(permission) {
                return Err(ApiError::Forbidden);
            }

            Ok(next.run(request).await)
        })
    }
}

// Usage in routes
pub fn payment_routes() -> Router<AppState> {
    Router::new()
        .route("/payments", post(create_payment))
        .route_layer(middleware::from_fn(require_permission("payments:create")))
        .route("/payments/:id", get(get_payment))
        .route_layer(middleware::from_fn(require_permission("payments:read")))
        .route("/payments/:id", delete(delete_payment))
        .route_layer(middleware::from_fn(require_permission("payments:delete")))
}
```

### Sensitive Data Protection

```rust
// Data encryption service
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::{rand_core::OsRng as ArgonOsRng, SaltString}};
use base64::{Engine as _, engine::general_purpose};

pub struct EncryptionService {
    cipher: Aes256Gcm,
}

impl EncryptionService {
    pub fn new(key: &[u8; 32]) -> Self {
        let cipher = Aes256Gcm::new_from_slice(key)
            .expect("Invalid key length");

        Self { cipher }
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<String, EncryptionError> {
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = self.cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|_| EncryptionError::EncryptionFailed)?;

        // Combine nonce and ciphertext for storage
        let mut result = nonce.to_vec();
        result.extend_from_slice(&ciphertext);

        Ok(general_purpose::STANDARD.encode(&result))
    }

    pub fn decrypt(&self, encrypted_data: &str) -> Result<String, EncryptionError> {
        let data = general_purpose::STANDARD
            .decode(encrypted_data)
            .map_err(|_| EncryptionError::InvalidFormat)?;

        if data.len() < 12 {
            return Err(EncryptionError::InvalidFormat);
        }

        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = self.cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| EncryptionError::DecryptionFailed)?;

        String::from_utf8(plaintext)
            .map_err(|_| EncryptionError::InvalidUtf8)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum EncryptionError {
    #[error("Encryption failed")]
    EncryptionFailed,
    #[error("Decryption failed")]
    DecryptionFailed,
    #[error("Invalid format")]
    InvalidFormat,
    #[error("Invalid UTF-8")]
    InvalidUtf8,
}

// Password hashing service
pub struct PasswordService {
    argon2: Argon2<'static>,
}

impl PasswordService {
    pub fn new() -> Self {
        Self {
            argon2: Argon2::default(),
        }
    }

    pub fn hash_password(&self, password: &str) -> Result<String, argon2::password_hash::Error> {
        let salt = SaltString::generate(&mut ArgonOsRng);
        let password_hash = self.argon2.hash_password(password.as_bytes(), &salt)?;
        Ok(password_hash.to_string())
    }

    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool, argon2::password_hash::Error> {
        let parsed_hash = PasswordHash::new(hash)?;
        match self.argon2.verify_password(password.as_bytes(), &parsed_hash) {
            Ok(()) => Ok(true),
            Err(argon2::password_hash::Error::Password) => Ok(false),
            Err(e) => Err(e),
        }
    }
}

// Secure logging that masks sensitive data
use tracing::{info, warn, error};

pub struct SecureLogger;

impl SecureLogger {
    pub fn log_payment_created(payment_id: &PaymentId, customer_id: &CustomerId, amount: rust_decimal::Decimal, currency: &str) {
        info!(
            payment_id = %payment_id,
            customer_id = %customer_id,
            amount = %amount,
            currency = %currency,
            "Payment created successfully"
        );
    }

    pub fn log_payment_attempt(request: &PaymentRequest) {
        // Only log non-sensitive data
        let card_last4 = if request.paying_card_details.card_number.len() >= 4 {
            &request.paying_card_details.card_number[request.paying_card_details.card_number.len()-4..]
        } else {
            "****"
        };

        info!(
            amount = %request.amount,
            currency = %request.currency,
            customer_id = %request.customer_id,
            card_last4 = %card_last4,
            "Payment attempt initiated"
        );
    }

    pub fn log_validation_failed(payment_id: &PaymentId, errors: &[String]) {
        warn!(
            payment_id = %payment_id,
            validation_errors = ?errors,
            "Payment validation failed"
        );
    }

    pub fn log_processing_error(payment_id: &PaymentId, error: &dyn std::error::Error) {
        error!(
            payment_id = %payment_id,
            error = %error,
            "Payment processing failed"
        );
    }
}
```

## Monitoring and Observability

### Structured Logging and Tracing

```rust
// Distributed tracing with OpenTelemetry
use opentelemetry::{
    global,
    trace::{TraceError, Tracer},
    KeyValue,
};
use opentelemetry_jaeger::JaegerTracer;
use tracing::{info, warn, error, instrument, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use uuid::Uuid;

pub struct PaymentService {
    repository: Arc<dyn PaymentRepository>,
    gateway: Arc<dyn PaymentGateway>,
    tracer: JaegerTracer,
}

impl PaymentService {
    #[instrument(
        name = "payment_service.process_payment",
        skip(self, request),
        fields(
            payment_id,
            customer_id = %request.customer_id,
            amount = %request.amount,
            currency = %request.currency
        )
    )]
    pub async fn process_payment(
        &self,
        request: PaymentRequest,
    ) -> Result<Payment, PaymentServiceError> {
        let payment_id = PaymentId::new();

        // Add payment ID to the current span
        Span::current().record("payment_id", &payment_id.to_string());

        info!("Starting payment processing");

        // Create a child span for validation
        let validation_span = self.tracer.start("payment_validation");
        let _guard = validation_span.with_subscriber(|(id, dispatch)| {
            dispatch.enter(id);
        });

        let validation_result = self.validate_payment(&request).await;
        validation_span.set_attribute(KeyValue::new("validation.success", validation_result.is_ok()));

        if let Err(ref e) = validation_result {
            validation_span.set_attribute(KeyValue::new("validation.error", e.to_string()));
            warn!("Payment validation failed: {}", e);
            return Err(PaymentServiceError::Validation(e.to_string()));
        }

        // Create payment entity
        let mut payment = Payment::new(
            request.amount,
            request.currency,
            request.customer_id,
            request.card_id,
        );

        // Process with gateway
        let gateway_span = self.tracer.start("gateway_authorization");
        let authorization_result = self.gateway.authorize_payment(&payment).await;
        gateway_span.set_attribute(KeyValue::new("gateway.success", authorization_result.is_ok()));

        match authorization_result {
            Ok(_) => {
                payment.mark_as_processed()?;
                self.repository.save(&payment).await?;

                info!(
                    payment_id = %payment.id,
                    amount = %payment.amount,
                    "Payment processed successfully"
                );

                Ok(payment)
            }
            Err(e) => {
                payment.mark_as_failed()?;
                self.repository.save(&payment).await?;

                error!(
                    payment_id = %payment.id,
                    error = %e,
                    "Payment processing failed"
                );

                Err(PaymentServiceError::ExternalService(e.to_string()))
            }
        }
    }

    #[instrument(
        name = "payment_service.validate_payment",
        skip(self, request),
        fields(amount = %request.amount, currency = %request.currency)
    )]
    async fn validate_payment(&self, request: &PaymentRequest) -> Result<(), ValidationError> {
        use validator::Validate;

        // Convert to DTO for validation
        let dto: CreatePaymentRequest = request.clone().into();
        dto.validate().map_err(|e| ValidationError::InvalidData(format!("{:?}", e)))?;

        // Business rule validations
        if request.amount <= rust_decimal::Decimal::ZERO {
            return Err(ValidationError::InvalidAmount);
        }

        if !["GBP", "USD", "EUR"].contains(&request.currency.as_str()) {
            return Err(ValidationError::InvalidCurrency);
        }

        info!("Payment validation completed successfully");
        Ok(())
    }
}

// Custom metrics for business operations
use prometheus::{Counter, Histogram, IntGauge, Registry, Opts, HistogramOpts};
use std::sync::Once;

static INIT_METRICS: Once = Once::new();

#[derive(Clone)]
pub struct PaymentMetrics {
    payments_processed_total: Counter,
    payments_failed_total: Counter,
    payment_processing_duration: Histogram,
    payment_amount_histogram: Histogram,
    active_payments_gauge: IntGauge,
}

impl PaymentMetrics {
    pub fn new(registry: &Registry) -> Result<Self, prometheus::Error> {
        let payments_processed_total = Counter::with_opts(Opts::new(
            "payments_processed_total",
            "Total number of payments processed"
        ).const_labels([("service", "payment_service")].iter().cloned().collect()))?;

        let payments_failed_total = Counter::with_opts(Opts::new(
            "payments_failed_total",
            "Total number of failed payments"
        ).const_labels([("service", "payment_service")].iter().cloned().collect()))?;

        let payment_processing_duration = Histogram::with_opts(HistogramOpts::new(
            "payment_processing_duration_seconds",
            "Payment processing duration in seconds"
        ).buckets(vec![0.1, 0.5, 1.0, 2.5, 5.0, 10.0]))?;

        let payment_amount_histogram = Histogram::with_opts(HistogramOpts::new(
            "payment_amount",
            "Payment amounts distribution"
        ).buckets(vec![10.0, 50.0, 100.0, 500.0, 1000.0, 5000.0, 10000.0]))?;

        let active_payments_gauge = IntGauge::with_opts(Opts::new(
            "active_payments",
            "Number of currently active payments"
        ))?;

        registry.register(Box::new(payments_processed_total.clone()))?;
        registry.register(Box::new(payments_failed_total.clone()))?;
        registry.register(Box::new(payment_processing_duration.clone()))?;
        registry.register(Box::new(payment_amount_histogram.clone()))?;
        registry.register(Box::new(active_payments_gauge.clone()))?;

        Ok(Self {
            payments_processed_total,
            payments_failed_total,
            payment_processing_duration,
            payment_amount_histogram,
            active_payments_gauge,
        })
    }

    pub fn record_payment_processed(&self, currency: &str, duration_seconds: f64, amount: f64) {
        self.payments_processed_total.inc();
        self.payment_processing_duration.observe(duration_seconds);
        self.payment_amount_histogram.observe(amount);
    }

    pub fn record_payment_failed(&self, currency: &str, error_type: &str) {
        self.payments_failed_total.inc();
    }

    pub fn set_active_payments(&self, count: i64) {
        self.active_payments_gauge.set(count);
    }
}

// Health checks
use axum::{http::StatusCode, response::Json};
use serde_json::{json, Value};

#[derive(Clone)]
pub struct HealthCheckService {
    db_pool: sqlx::PgPool,
    redis_pool: deadpool_redis::Pool,
    payment_gateway: Arc<dyn PaymentGateway>,
}

impl HealthCheckService {
    pub fn new(
        db_pool: sqlx::PgPool,
        redis_pool: deadpool_redis::Pool,
        payment_gateway: Arc<dyn PaymentGateway>,
    ) -> Self {
        Self {
            db_pool,
            redis_pool,
            payment_gateway,
        }
    }

    pub async fn check_health(&self) -> (StatusCode, Json<Value>) {
        let mut checks = std::collections::HashMap::new();
        let mut overall_status = "healthy";

        // Database health check
        let db_status = self.check_database().await;
        checks.insert("database", db_status.clone());
        if db_status["status"] != "healthy" {
            overall_status = "unhealthy";
        }

        // Redis health check
        let redis_status = self.check_redis().await;
        checks.insert("redis", redis_status.clone());
        if redis_status["status"] != "healthy" {
            overall_status = "degraded";
        }

        // Payment gateway health check
        let gateway_status = self.check_payment_gateway().await;
        checks.insert("payment_gateway", gateway_status.clone());
        if gateway_status["status"] != "healthy" {
            overall_status = "degraded";
        }

        let status_code = match overall_status {
            "healthy" => StatusCode::OK,
            "degraded" => StatusCode::OK,
            _ => StatusCode::SERVICE_UNAVAILABLE,
        };

        let response = json!({
            "status": overall_status,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "checks": checks
        });

        (status_code, Json(response))
    }

    async fn check_database(&self) -> Value {
        match sqlx::query("SELECT 1").fetch_one(&self.db_pool).await {
            Ok(_) => json!({
                "status": "healthy",
                "message": "Database connection successful"
            }),
            Err(e) => json!({
                "status": "unhealthy",
                "message": format!("Database connection failed: {}", e)
            }),
        }
    }

    async fn check_redis(&self) -> Value {
        match self.redis_pool.get().await {
            Ok(mut conn) => {
                match redis::cmd("PING").query_async::<_, String>(&mut conn).await {
                    Ok(_) => json!({
                        "status": "healthy",
                        "message": "Redis connection successful"
                    }),
                    Err(e) => json!({
                        "status": "unhealthy",
                        "message": format!("Redis ping failed: {}", e)
                    }),
                }
            }
            Err(e) => json!({
                "status": "unhealthy",
                "message": format!("Redis connection failed: {}", e)
            }),
        }
    }

    async fn check_payment_gateway(&self) -> Value {
        match self.payment_gateway.health_check().await {
            Ok(_) => json!({
                "status": "healthy",
                "message": "Payment gateway is accessible"
            }),
            Err(e) => json!({
                "status": "unhealthy",
                "message": format!("Payment gateway check failed: {}", e)
            }),
        }
    }
}

// Health check endpoints
pub async fn health_handler(
    State(health_service): State<HealthCheckService>,
) -> impl IntoResponse {
    health_service.check_health().await
}

pub async fn readiness_handler(
    State(app_state): State<AppState>,
) -> impl IntoResponse {
    // Check if critical services are ready
    match sqlx::query("SELECT 1").fetch_one(&app_state.db_pool).await {
        Ok(_) => (StatusCode::OK, Json(json!({"status": "ready"}))),
        Err(_) => (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"status": "not ready"}))),
    }
}

pub async fn liveness_handler() -> impl IntoResponse {
    // Simple liveness check - if this endpoint responds, the service is alive
    (StatusCode::OK, Json(json!({"status": "alive"})))
}
```

## Cargo.toml Configuration

```toml
# Cargo.toml
[package]
name = "payment-service"
version = "0.1.0"
edition = "2021"
rust-version = "1.75"

[dependencies]
# Web framework
axum = { version = "0.7", features = ["macros"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "trace", "timeout"] }
hyper = { version = "1.0", features = ["full"] }

# Async runtime
tokio = { version = "1.0", features = ["full"] }
futures = "0.3"

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Database
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "postgres", "chrono", "uuid", "json", "rust_decimal"] }

# Redis
redis = { version = "0.24", features = ["tokio-comp", "connection-manager"] }
deadpool-redis = "0.14"

# Validation
validator = { version = "0.18", features = ["derive"] }

# UUID
uuid = { version = "1.6", features = ["v4", "serde"] }

# Decimal arithmetic
rust_decimal = { version = "1.32", features = ["serde-with-str"] }
rust_decimal_macros = "1.32"

# Date/time
chrono = { version = "0.4", features = ["serde"] }

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# HTTP client
reqwest = { version = "0.11", features = ["json", "rustls-tls"] }

# Logging and tracing
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json", "env-filter"] }
tracing-opentelemetry = "0.22"
opentelemetry = "0.21"
opentelemetry-jaeger = "0.20"

# Metrics
prometheus = "0.13"

# Configuration
config = "0.14"

# Security
jsonwebtoken = "9.2"
argon2 = "0.5"
aes-gcm = "0.10"
html-escape = "0.2"

# Async traits
async-trait = "0.1"

# Regular expressions
regex = "1.10"
lazy_static = "1.4"

# String operations
heapless = "0.8"

[dev-dependencies]
# Testing
tokio-test = "0.4"
rstest = "0.18"
testcontainers = "0.15"
proptest = "1.4"
mockall = "0.12"

# Test utilities
tempfile = "3.8"

[profile.release]
# Optimize for performance in release builds
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"

[profile.dev]
# Faster compilation in development
opt-level = 0
debug = true

[profile.test]
# Optimize tests for faster execution
opt-level = 1
```

This comprehensive Rust development guide provides:

1. **TDD-First Approach**: Every feature starts with a failing test
2. **Type Safety**: Leverages Rust's type system for correctness
3. **Memory Safety**: Uses ownership and borrowing for safe concurrency
4. **Functional Patterns**: Emphasizes immutability and pure functions
5. **Ports & Adapters**: Clean architecture with domain separation
6. **Axum Integration**: Modern async web framework
7. **Database Safety**: Compile-time checked SQL queries with SQLx
8. **Security**: Input validation, authentication, encryption
9. **Observability**: Structured logging, tracing, and metrics
10. **Performance**: Zero-cost abstractions and efficient resource management

The guide emphasizes Rust's unique strengths while following the same rigorous testing and architectural principles as the original .NET guide.
