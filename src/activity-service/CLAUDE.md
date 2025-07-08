# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **serverless activity tracking service** built as part of the Datadog serverless sample application. It processes events from EventBridge via SQS queues and provides a REST API for retrieving activity data, demonstrating production-ready serverless best practices.

**Tech Stack:**
- Python 3.13 with Poetry for dependency management
- AWS CDK for Infrastructure as Code
- AWS Lambda Powertools for observability
- Pydantic for data validation
- AWS services: Lambda, DynamoDB, API Gateway, SQS, EventBridge

## Development Commands

**Setup:**
```bash
make dev           # Install dependencies and setup pre-commit hooks
```

**Code Quality:**
```bash
make format        # Run ruff check with --fix
make format-fix    # Run ruff format
make lint          # Run format + mypy type checking
make mypy-lint     # Run mypy on activity_service, cdk, tests
make pre-commit    # Run all pre-commit hooks
make complex       # Run radon + xenon complexity analysis
```

**Testing:**
```bash
make unit          # Unit tests with coverage
make integration   # Integration tests with coverage
make integration           # End-to-end tests with coverage
make infra-tests   # Infrastructure/CDK tests
make coverage-tests # Combined unit + integration coverage
```

**Deployment:**
```bash
make build         # Build lambdas and export dependencies
make deploy        # Deploy stack to AWS using CDK
make destroy       # Destroy AWS stack
make watch         # CDK watch mode for development
```

**Documentation:**
```bash
make docs          # Serve mkdocs documentation locally
make openapi       # Generate OpenAPI/Swagger documentation
make compare-openapi # Verify OpenAPI docs are up to date
```

**Full CI/CD Pipeline:**
```bash
make pr            # Complete pipeline: deps format pre-commit complex lint lint-docs unit deploy coverage-tests integration openapi
```

## Architecture Overview

**Application Structure (`/activity_service/`):**
- `handlers/` - Lambda function entry points
  - `create_activity.py` - SQS event processor
  - `handle_get_activity.py` - REST API handler
  - `utils/` - Observability, idempotency, REST utilities
- `logic/` - Business logic layer
- `dal/` - Data Access Layer (DynamoDB operations)
- `models/` - Pydantic data models

**Infrastructure (`/cdk/`):**
- `service_stack.py` - Main CDK stack
- `api_construct.py` - API Gateway + Lambda
- `api_db_construct.py` - DynamoDB configuration
- `monitoring.py` - CloudWatch dashboards/alarms
- `configuration/` - AppConfig setup

**Testing Strategy (`/tests/`):**
- `unit/` - Unit tests for components
- `integration/` - AWS service integration tests
- `e2e/` - End-to-end workflow tests
- `infrastructure/` - CDK infrastructure tests

## Core Philosophy

**TEST-DRIVEN DEVELOPMENT IS NON-NEGOTIABLE.** Every single line of production code must be written in response to a failing test. No exceptions. This is not a suggestion or a preference - it is the fundamental practice that enables all other principles in this document.

I follow Test-Driven Development (TDD) with a strong emphasis on behavior-driven testing and Pythonic programming principles. All work should be done in small, incremental changes that maintain a working state throughout development.

## Quick Reference

**Key Principles:**

- Write tests first (TDD)
- Test behavior, not implementation
- No `Any` types or `# type: ignore` without justification
- Immutable data patterns where appropriate
- Small, pure functions
- Python 3.12+ with strict type checking
- Use real schemas/types in tests, never redefine them
- Follow PEP 8 and modern Python idioms

**Preferred Tools:**

- **Language**: Python 3.12+ with type hints
- **Testing**: pytest + hypothesis for property-based testing
- **Type Checking**: mypy in strict mode
- **Linting**: ruff (replaces flake8, isort, black)
- **Schema Validation**: Pydantic v2 for data validation and serialization
- **Package Management**: poetry for dependency management

## Testing Principles

### Behavior-Driven Testing

- **No "unit tests"** - this term is not helpful. Tests should verify expected behavior, treating implementation as a black box
- Test through the public API exclusively - internals should be invisible to tests
- No 1:1 mapping between test files and implementation files
- Tests that examine internal implementation details are wasteful and should be avoided
- **Coverage targets**: 100% coverage should be expected at all times, but these tests must ALWAYS be based on business behaviour, not implementation details
- Tests must document expected business behaviour

### Testing Tools

- **pytest** for testing framework with fixtures and parametrization
- **hypothesis** for property-based testing to find edge cases
- **pytest-mock** for mocking when needed (prefer dependency injection)
- **httpx** with respx for HTTP client testing
- All test code must follow the same type checking rules as production code

### Test Organization

```
src/
  features/
    payment/
      payment_processor.py
      payment_validator.py
      test_payment_processor.py  # The validator is an implementation detail. Validation is fully covered, but by testing the expected business behaviour, treating the validation code itself as an implementation detail
```

### Test Data Pattern

Use factory functions with optional overrides for test data, leveraging Pydantic models:

```python
from typing import Any
from decimal import Decimal
from pydantic import BaseModel

class AddressDetails(BaseModel):
    house_number: str
    house_name: str | None = None
    address_line_1: str
    address_line_2: str | None = None
    city: str
    postcode: str

class PayingCardDetails(BaseModel):
    cvv: str
    token: str

class PostPaymentsRequestV3(BaseModel):
    card_account_id: str
    amount: Decimal
    source: Literal["Web", "Mobile", "API"]
    account_status: Literal["Normal", "Restricted", "Closed"]
    last_name: str
    date_of_birth: str  # Consider using datetime.date with custom validator
    paying_card_details: PayingCardDetails
    address_details: AddressDetails
    brand: Literal["Visa", "Mastercard", "Amex"]

def get_mock_payment_request(
    **overrides: Any,
) -> PostPaymentsRequestV3:
    """Factory function for creating test payment requests."""
    base_data = {
        "card_account_id": "1234567890123456",
        "amount": Decimal("100.00"),
        "source": "Web",
        "account_status": "Normal",
        "last_name": "Doe",
        "date_of_birth": "1980-01-01",
        "paying_card_details": get_mock_card_details(),
        "address_details": get_mock_address_details(),
        "brand": "Visa",
    }
    base_data.update(overrides)
    return PostPaymentsRequestV3.model_validate(base_data)

def get_mock_address_details(**overrides: Any) -> AddressDetails:
    """Factory function for creating test address details."""
    base_data = {
        "house_number": "123",
        "house_name": "Test House",
        "address_line_1": "Test Address Line 1", 
        "address_line_2": "Test Address Line 2",
        "city": "Test City",
        "postcode": "SW1A 1AA",
    }
    base_data.update(overrides)
    return AddressDetails.model_validate(base_data)

def get_mock_card_details(**overrides: Any) -> PayingCardDetails:
    """Factory function for creating test card details."""
    base_data = {
        "cvv": "123",
        "token": "test_token_123",
    }
    base_data.update(overrides)
    return PayingCardDetails.model_validate(base_data)
```

Key principles:

- Always return complete objects with sensible defaults
- Accept keyword arguments for overrides using `**overrides`
- Build incrementally - extract nested object factories as needed
- Compose factories for complex objects
- Use Pydantic's `model_validate` to ensure type safety
- Consider using a test data builder pattern with `dataclasses` for very complex objects

## Python Type System Guidelines

### Strict Type Checking Requirements

```toml
# pyproject.toml
[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
disallow_untyped_decorators = true
no_implicit_optional = true
warn_redundant_casts = true
warn_unused_ignores = true
warn_no_return = true
warn_unreachable = true
strict_equality = true
```

- **No `Any`** - ever. Use `object` or proper union types if type is truly unknown
- **No `# type: ignore`** without explicit explanation and issue tracking
- **Use `from __future__ import annotations`** for forward references and cleaner syntax
- These rules apply to test code as well as production code

### Type Definitions

- **Use `type` aliases** for complex types and domain-specific types
- Use explicit typing where it aids clarity, but leverage inference where appropriate
- Create NewType for domain-specific types (e.g., `UserId`, `PaymentId`) for type safety
- Use Pydantic models for data validation and serialization
- Prefer `dataclasses` for simple data containers when validation isn't needed

```python
from __future__ import annotations

from decimal import Decimal
from typing import NewType
from dataclasses import dataclass
from pydantic import BaseModel, Field

# Good - Domain-specific types for type safety
UserId = NewType("UserId", str)
PaymentAmount = NewType("PaymentAmount", Decimal)

# Type aliases for complex types
PaymentResult = dict[str, str | Decimal | bool]
CustomerTier = Literal["standard", "premium", "enterprise"]

# Avoid - Primitive obsession
def process_payment(user_id: str, amount: Decimal) -> dict[str, Any]:
    ...

# Good - Type safety with NewType
def process_payment(user_id: UserId, amount: PaymentAmount) -> PaymentResult:
    ...
```

#### Schema-First Development with Pydantic

Always define your schemas first using Pydantic v2, then derive behavior from them:

```python
from __future__ import annotations

from decimal import Decimal
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator
import re

class AddressDetails(BaseModel):
    """Address information for payment processing."""
    house_number: str = Field(min_length=1)
    house_name: str | None = None
    address_line_1: str = Field(min_length=1)
    address_line_2: str | None = None
    city: str = Field(min_length=1)
    postcode: str
    
    @field_validator('postcode')
    @classmethod
    def validate_postcode(cls, v: str) -> str:
        pattern = r'^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$'
        if not re.match(pattern, v, re.IGNORECASE):
            raise ValueError('Invalid UK postcode format')
        return v.upper()

class PayingCardDetails(BaseModel):
    """Card details for payment processing."""
    cvv: str = Field(pattern=r'^\d{3,4}$')
    token: str = Field(min_length=1)

class PostPaymentsRequestV3(BaseModel):
    """Request schema for payment processing API v3."""
    card_account_id: str = Field(min_length=16, max_length=16)
    amount: Decimal = Field(gt=0, decimal_places=2)
    source: Literal["Web", "Mobile", "API"]
    account_status: Literal["Normal", "Restricted", "Closed"]
    last_name: str = Field(min_length=1)
    date_of_birth: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    paying_card_details: PayingCardDetails
    address_details: AddressDetails
    brand: Literal["Visa", "Mastercard", "Amex"]
    
    @model_validator(mode='after')
    def validate_account_status_with_amount(self) -> PostPaymentsRequestV3:
        if self.account_status == "Restricted" and self.amount > Decimal("500"):
            raise ValueError("Restricted accounts cannot process payments over £500")
        return self

# Use schemas at runtime boundaries
def parse_payment_request(data: dict[str, Any]) -> PostPaymentsRequestV3:
    """Parse and validate payment request data."""
    return PostPaymentsRequestV3.model_validate(data)

# Example of schema composition for complex domains
class BaseEntity(BaseModel):
    """Base model with common fields for all entities."""
    id: str = Field(pattern=r'^[a-f0-9-]{36}$')  # UUID format
    created_at: datetime
    updated_at: datetime

class Customer(BaseEntity):
    """Customer entity with validation."""
    email: str = Field(pattern=r'^[^@]+@[^@]+\.[^@]+$')
    tier: CustomerTier
    credit_limit: Decimal = Field(gt=0)
    
    @field_validator('email')
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        # Custom business logic for email validation
        allowed_domains = {'company.com', 'partner.org'}
        domain = v.split('@')[1].lower()
        if domain not in allowed_domains:
            raise ValueError(f'Email domain {domain} not allowed')
        return v.lower()
```

#### Schema Usage in Tests

**CRITICAL**: Tests must use real schemas and types from the main project, not redefine their own.

```python
# ❌ WRONG - Defining schemas in test files
from pydantic import BaseModel

class ProjectSchema(BaseModel):  # Don't do this in tests!
    id: str
    workspace_id: str
    owner_id: str | None
    name: str
    created_at: datetime
    updated_at: datetime

# ✅ CORRECT - Import schemas from the shared schema package
from your_project.schemas import Project, ProjectSchema
```

**Why this matters:**

- **Type Safety**: Ensures tests use the same types as production code
- **Consistency**: Changes to schemas automatically propagate to tests
- **Maintainability**: Single source of truth for data structures
- **Prevents Drift**: Tests can't accidentally diverge from real schemas

**Implementation:**

- All domain schemas should be exported from a shared schema module
- Test files should import schemas from the shared location
- If a schema isn't exported yet, add it to the exports rather than duplicating it
- Mock data factories should use the real Pydantic models

```python
# ✅ CORRECT - Test factories using real schemas
from your_project.schemas import Project

def get_mock_project(**overrides: Any) -> Project:
    """Factory for creating test Project instances."""
    base_data = {
        "id": "proj_123",
        "workspace_id": "ws_456", 
        "owner_id": "user_789",
        "name": "Test Project",
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
    }
    base_data.update(overrides)
    
    # Validate against real schema to catch type mismatches
    return Project.model_validate(base_data)
```

## Code Style

### Pythonic Programming

Follow the Zen of Python and modern Python idioms:

- **Explicit is better than implicit** - use clear names and avoid magic
- **Flat is better than nested** - prefer early returns and guard clauses
- **Simple is better than complex** - don't over-engineer solutions
- **Readability counts** - code is read more often than written
- Use list/dict comprehensions judiciously - prefer clarity over cleverness

#### Examples of Pythonic Patterns

```python
from __future__ import annotations

from decimal import Decimal
from typing import Iterator
from dataclasses import dataclass

# Good - Pythonic data handling
@dataclass(frozen=True)  # Immutable by default
class OrderItem:
    price: Decimal
    quantity: int
    
    @property
    def total(self) -> Decimal:
        return self.price * self.quantity

@dataclass(frozen=True)
class Order:
    items: tuple[OrderItem, ...]  # Immutable sequence
    shipping_cost: Decimal
    
    @property
    def items_total(self) -> Decimal:
        return sum(item.total for item in self.items)
    
    @property
    def total(self) -> Decimal:
        return self.items_total + self.shipping_cost

# Good - Pure function with immutable updates
def apply_discount(order: Order, discount_percent: Decimal) -> Order:
    """Apply discount to order items, returning new order."""
    discount_multiplier = (100 - discount_percent) / 100
    
    discounted_items = tuple(
        OrderItem(
            price=item.price * discount_multiplier,
            quantity=item.quantity
        )
        for item in order.items
    )
    
    return Order(
        items=discounted_items,
        shipping_cost=order.shipping_cost
    )

# Good - Generator for memory efficiency
def process_orders_batch(orders: list[Order]) -> Iterator[ProcessedOrder]:
    """Process orders one at a time to avoid memory issues."""
    for order in orders:
        validated_order = validate_order(order)
        priced_order = apply_promotions(validated_order)
        yield finalize_order(priced_order)

# Good - Context manager for resource management
from contextlib import contextmanager
from typing import Generator

@contextmanager
def payment_transaction(payment_id: str) -> Generator[PaymentContext, None, None]:
    """Manage payment transaction lifecycle."""
    context = PaymentContext(payment_id)
    try:
        context.begin()
        yield context
        context.commit()
    except Exception:
        context.rollback()
        raise
    finally:
        context.close()

# Usage
def process_payment(payment: Payment) -> ProcessedPayment:
    with payment_transaction(payment.id) as txn:
        authorized = authorize_payment(payment, txn)
        captured = capture_payment(authorized, txn)
        return generate_receipt(captured)

# Good - Using Protocol for duck typing instead of inheritance
from typing import Protocol

class Payable(Protocol):
    """Protocol for objects that can be charged."""
    def charge(self, amount: Decimal) -> PaymentResult: ...
    def refund(self, amount: Decimal) -> RefundResult: ...

class CreditCard:
    def charge(self, amount: Decimal) -> PaymentResult:
        # Implementation
        ...
    
    def refund(self, amount: Decimal) -> RefundResult:
        # Implementation
        ...

class BankAccount:
    def charge(self, amount: Decimal) -> PaymentResult:
        # Implementation
        ...
    
    def refund(self, amount: Decimal) -> RefundResult:
        # Implementation
        ...

def process_payment(payment_method: Payable, amount: Decimal) -> PaymentResult:
    """Process payment using any payable method."""
    return payment_method.charge(amount)
```

### Code Structure

- **Use early returns** instead of nested if/else statements
- **Leverage Python's truthiness** but be explicit when dealing with falsy values
- **Keep functions small** and focused on a single responsibility
- **Use dataclasses or Pydantic** for structured data
- **Prefer composition over inheritance**

```python
# Avoid: Nested conditionals
def process_user_order(user: User, order: Order) -> ProcessedOrder | None:
    if user:
        if user.is_active:
            if user.has_permission('place_order'):
                if order:
                    if order.is_valid():
                        # Deep nesting makes code hard to follow
                        return execute_order(order)
    return None

# Good: Early returns with clear error handling
def process_user_order(user: User, order: Order) -> ProcessedOrder:
    if not user:
        raise ValueError("User is required")
    
    if not user.is_active:
        raise UserInactiveError("User account is inactive")
        
    if not user.has_permission('place_order'):
        raise PermissionError("User lacks order placement permission")
        
    if not order:
        raise ValueError("Order is required")
        
    if not order.is_valid():
        raise OrderValidationError("Order failed validation")
    
    return execute_order(order)

# Good: Using truthiness appropriately
def get_display_name(user: User) -> str:
    """Get user display name with fallback."""
    # Explicit about what we're checking
    if not user.first_name and not user.last_name:
        return user.email or "Anonymous User"
    
    name_parts = [user.first_name, user.last_name]
    return " ".join(part for part in name_parts if part)

# Avoid: Checking for specific falsy values when truthiness works
def has_items(order: Order) -> bool:
    return len(order.items) > 0  # Unnecessary

# Good: Using truthiness
def has_items(order: Order) -> bool:
    return bool(order.items)
```

### Naming Conventions

- **Functions and variables**: `snake_case`
- **Classes**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Private attributes**: `_leading_underscore`
- **Modules**: `snake_case.py`
- **Test files**: `test_*.py` or `*_test.py`

```python
# Good naming examples
class PaymentProcessor:
    """Handles payment processing operations."""
    
    MAXIMUM_RETRY_ATTEMPTS = 3
    
    def __init__(self, api_client: PaymentApiClient) -> None:
        self._api_client = api_client
        self._retry_count = 0
    
    def process_payment(self, payment_request: PaymentRequest) -> PaymentResult:
        """Process a payment request with retry logic."""
        return self._attempt_payment_with_retry(payment_request)
    
    def _attempt_payment_with_retry(self, request: PaymentRequest) -> PaymentResult:
        """Internal method for payment processing with retries."""
        # Implementation
        ...
```

### No Comments in Code

Code should be self-documenting through clear naming and structure. Comments indicate that the code itself is not clear enough.

```python
# Avoid: Comments explaining what the code does
def calculate_discount(price: Decimal, customer: Customer) -> Decimal:
    # Check if customer is premium
    if customer.tier == "premium":
        # Apply 20% discount for premium customers
        return price * Decimal("0.8")
    # Regular customers get 10% discount
    return price * Decimal("0.9")

# Good: Self-documenting code with clear names
PREMIUM_DISCOUNT_MULTIPLIER = Decimal("0.8")
STANDARD_DISCOUNT_MULTIPLIER = Decimal("0.9")

def is_premium_customer(customer: Customer) -> bool:
    return customer.tier == "premium"

def calculate_discount(price: Decimal, customer: Customer) -> Decimal:
    discount_multiplier = (
        PREMIUM_DISCOUNT_MULTIPLIER
        if is_premium_customer(customer)
        else STANDARD_DISCOUNT_MULTIPLIER
    )
    return price * discount_multiplier

# Avoid: Complex logic with comments
def process_payment(payment: Payment) -> ProcessedPayment:
    # First validate the payment
    if not validate_payment(payment):
        raise PaymentValidationError("Invalid payment")
    
    # Check if we need to apply 3D secure
    if payment.amount > 100 and payment.card.type == "credit":
        # Apply 3D secure for credit cards over £100
        secure_payment = apply_3d_secure(payment)
        # Process the secure payment
        return execute_payment(secure_payment)
    
    # Process the payment normally
    return execute_payment(payment)

# Good: Extract to well-named functions
SECURE_PAYMENT_THRESHOLD = Decimal("100")

def requires_3d_secure(payment: Payment) -> bool:
    return (
        payment.amount > SECURE_PAYMENT_THRESHOLD 
        and payment.card.type == "credit"
    )

def process_payment(payment: Payment) -> ProcessedPayment:
    if not validate_payment(payment):
        raise PaymentValidationError("Invalid payment")
    
    secured_payment = (
        apply_3d_secure(payment)
        if requires_3d_secure(payment)
        else payment
    )
    
    return execute_payment(secured_payment)
```

**Exception**: Docstrings for public APIs are required and should follow Google or NumPy style. Type hints should make the docstring parameter descriptions unnecessary in most cases.

```python
def calculate_shipping_cost(
    items: list[OrderItem],
    destination: Address,
    shipping_method: ShippingMethod,
) -> Decimal:
    """Calculate shipping cost for order items.
    
    Args:
        items: List of items to ship
        destination: Shipping destination address
        shipping_method: Selected shipping method
        
    Returns:
        Calculated shipping cost
        
    Raises:
        ShippingCalculationError: When shipping cost cannot be determined
    """
    # Implementation
    ...
```

### Keyword Arguments and Default Values

Use keyword arguments extensively for clarity, especially for functions with multiple parameters:

```python
# Avoid: Multiple positional parameters
def create_payment(
    amount: Decimal,
    currency: str,
    card_id: str,
    customer_id: str,
    description: str | None = None,
    metadata: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
) -> Payment:
    # implementation
    ...

# Calling it is unclear
payment = create_payment(
    Decimal("100"),
    "GBP", 
    "card_123",
    "cust_456",
    None,
    {"order_id": "order_789"},
    "key_123"
)

# Good: Use keyword arguments with dataclass or Pydantic model
@dataclass(frozen=True)
class CreatePaymentRequest:
    amount: Decimal
    currency: str
    card_id: str
    customer_id: str
    description: str | None = None
    metadata: dict[str, Any] | None = None
    idempotency_key: str | None = None

def create_payment(request: CreatePaymentRequest) -> Payment:
    # implementation using request.amount, request.currency, etc.
    ...

# Clear and readable at call site
payment = create_payment(CreatePaymentRequest(
    amount=Decimal("100"),
    currency="GBP",
    card_id="card_123",
    customer_id="cust_456",
    metadata={"order_id": "order_789"},
    idempotency_key="key_123",
))

# Alternative: Use keyword-only arguments for complex functions
def fetch_customers(
    *,  # Forces keyword-only arguments
    include_inactive: bool = False,
    include_pending: bool = False,
    include_deleted: bool = False,
    sort_by: Literal["date", "name", "value"] = "name",
    limit: int = 100,
) -> list[Customer]:
    # implementation
    ...

# Self-documenting at call site
customers = fetch_customers(
    include_inactive=True,
    sort_by="date",
    limit=50,
)

# Good: Using Pydantic for complex configuration
class ProcessOrderConfig(BaseModel):
    order: Order
    shipping_method: Literal["standard", "express", "overnight"] = "standard"
    shipping_address: Address
    payment_method: PaymentMethod
    save_payment_for_future: bool = False
    promotion_codes: list[str] = Field(default_factory=list)
    auto_apply_promotions: bool = True

def process_order(config: ProcessOrderConfig) -> ProcessedOrder:
    # Clear access to all configuration
    order_with_promotions = (
        apply_available_promotions(config.order)
        if config.auto_apply_promotions
        else config.order
    )
    
    return execute_order(
        order_with_promotions,
        shipping_method=config.shipping_method,
        payment_method=config.payment_method,
    )

# Acceptable: Simple functions with 1-2 parameters
def double(n: int) -> int:
    return n * 2

def get_user_name(user: User) -> str:
    return f"{user.first_name} {user.last_name}"

# Acceptable: Well-established patterns
numbers = [1, 2, 3]
doubled = [double(n) for n in numbers]
users = fetch_users()
names = [get_user_name(user) for user in users]
```

## Development Workflow

### TDD Process - THE FUNDAMENTAL PRACTICE

**CRITICAL**: TDD is not optional. Every feature, every bug fix, every change MUST follow this process:

Follow Red-Green-Refactor strictly:

1. **Red**: Write a failing test for the desired behavior. NO PRODUCTION CODE until you have a failing test.
2. **Green**: Write the MINIMUM code to make the test pass. Resist the urge to write more than needed.
3. **Refactor**: Assess the code for improvement opportunities. If refactoring would add value, clean up the code while keeping tests green. If the code is already clean and expressive, move on.

**Common TDD Violations to Avoid:**

- Writing production code without a failing test first
- Writing multiple tests before making the first one pass
- Writing more production code than needed to pass the current test
- Skipping the refactor assessment step when code could be improved
- Adding functionality "while you're there" without a test driving it

**Remember**: If you're typing production code and there isn't a failing test demanding that code, you're not doing TDD.

#### TDD Example Workflow

```python
# Step 1: Red - Start with the simplest behavior
import pytest
from decimal import Decimal

def test_order_processing_calculates_total_with_shipping():
    """Should calculate total including shipping cost."""
    order = create_order(
        items=[OrderItem(price=Decimal("30"), quantity=1)],
        shipping_cost=Decimal("5.99")
    )
    
    processed = process_order(order)
    
    assert processed.total == Decimal("35.99")
    assert processed.shipping_cost == Decimal("5.99")

# Step 2: Green - Minimal implementation
@dataclass(frozen=True)
class ProcessedOrder:
    items: tuple[OrderItem, ...]
    shipping_cost: Decimal
    total: Decimal

def process_order(order: Order) -> ProcessedOrder:
    items_total = sum(
        item.price * item.quantity 
        for item in order.items
    )
    
    return ProcessedOrder(
        items=order.items,
        shipping_cost=order.shipping_cost,
        total=items_total + order.shipping_cost,
    )

# Step 3: Red - Add test for free shipping behavior
def test_order_processing_applies_free_shipping_over_fifty_pounds():
    """Should apply free shipping for orders over £50."""
    order = create_order(
        items=[OrderItem(price=Decimal("60"), quantity=1)],
        shipping_cost=Decimal("5.99")
    )
    
    processed = process_order(order)
    
    assert processed.shipping_cost == Decimal("0")
    assert processed.total == Decimal("60")

# Step 4: Green - NOW we can add the conditional because both paths are tested
def process_order(order: Order) -> ProcessedOrder:
    items_total = sum(
        item.price * item.quantity 
        for item in order.items
    )
    
    shipping_cost = (
        Decimal("0") 
        if items_total > Decimal("50") 
        else order.shipping_cost
    )
    
    return ProcessedOrder(
        items=order.items,
        shipping_cost=shipping_cost,
        total=items_total + shipping_cost,
    )

# Step 5: Add edge case tests to ensure 100% behavior coverage
def test_order_processing_charges_shipping_for_exactly_fifty_pounds():
    """Should charge shipping for orders exactly at £50."""
    order = create_order(
        items=[OrderItem(price=Decimal("50"), quantity=1)],
        shipping_cost=Decimal("5.99")
    )
    
    processed = process_order(order)
    
    assert processed.shipping_cost == Decimal("5.99")
    assert processed.total == Decimal("55.99")

# Step 6: Refactor - Extract constants and improve readability
FREE_SHIPPING_THRESHOLD = Decimal("50")

def calculate_items_total(items: tuple[OrderItem, ...]) -> Decimal:
    return sum(item.price * item.quantity for item in items)

def qualifies_for_free_shipping(items_total: Decimal) -> bool:
    return items_total > FREE_SHIPPING_THRESHOLD

def process_order(order: Order) -> ProcessedOrder:
    items_total = calculate_items_total(order.items)
    shipping_cost = (
        Decimal("0")
        if qualifies_for_free_shipping(items_total)
        else order.shipping_cost
    )
    
    return ProcessedOrder(
        items=order.items,
        shipping_cost=shipping_cost,
        total=items_total + shipping_cost,
    )
```

### Refactoring - The Critical Third Step

Evaluating refactoring opportunities is not optional - it's the third step in the TDD cycle. After achieving a green state and committing your work, you MUST assess whether the code can be improved. However, only refactor if there's clear value - if the code is already clean and expresses intent well, move on to the next test.

#### What is Refactoring?

Refactoring means changing the internal structure of code without changing its external behavior. The public API remains unchanged, all tests continue to pass, but the code becomes cleaner, more maintainable, or more efficient. Remember: only refactor when it genuinely improves the code - not all code needs refactoring.

#### When to Refactor

- **Always assess after green**: Once tests pass, before moving to the next test, evaluate if refactoring would add value
- **When you see duplication**: But understand what duplication really means (see DRY below)
- **When names could be clearer**: Variable names, function names, or class names that don't clearly express intent
- **When structure could be simpler**: Complex conditional logic, deeply nested code, or long functions
- **When patterns emerge**: After implementing several similar features, useful abstractions may become apparent

**Remember**: Not all code needs refactoring. If the code is already clean, expressive, and well-structured, commit and move on. Refactoring should improve the code - don't change things just for the sake of change.

#### Refactoring Guidelines

##### 1. Commit Before Refactoring

Always commit your working code before starting any refactoring. This gives you a safe point to return to:

```bash
git add .
git commit -m "feat: add payment validation"
# Now safe to refactor
```

##### 2. Look for Useful Abstractions Based on Semantic Meaning

Create abstractions only when code shares the same semantic meaning and purpose. Don't abstract based on structural similarity alone - **duplicate code is far cheaper than the wrong abstraction**.

```python
# Similar structure, DIFFERENT semantic meaning - DO NOT ABSTRACT
def validate_payment_amount(amount: Decimal) -> bool:
    return amount > 0 and amount <= Decimal("10000")

def validate_transfer_amount(amount: Decimal) -> bool:
    return amount > 0 and amount <= Decimal("10000")

# These might have the same structure today, but they represent different
# business concepts that will likely evolve independently.
# Payment limits might change based on fraud rules.
# Transfer limits might change based on account type.
# Abstracting them couples unrelated business rules.

# Similar structure, SAME semantic meaning - SAFE TO ABSTRACT
def format_user_display_name(first_name: str, last_name: str) -> str:
    return f"{first_name} {last_name}".strip()

def format_customer_display_name(first_name: str, last_name: str) -> str:
    return f"{first_name} {last_name}".strip()

def format_employee_display_name(first_name: str, last_name: str) -> str:
    return f"{first_name} {last_name}".strip()

# These all represent the same concept: "how we format a person's name for display"
# They share semantic meaning, not just structure
def format_person_display_name(first_name: str, last_name: str) -> str:
    return f"{first_name} {last_name}".strip()

# Replace all call sites throughout the codebase and remove original functions
```

**Questions to ask before abstracting:**

- Do these code blocks represent the same concept or different concepts that happen to look similar?
- If the business rules for one change, should the others change too?
- Would a developer reading this abstraction understand why these things are grouped together?
- Am I abstracting based on what the code IS (structure) or what it MEANS (semantics)?

##### 3. Understanding DRY - It's About Knowledge, Not Code

DRY (Don't Repeat Yourself) is about not duplicating **knowledge** in the system, not about eliminating all code that looks similar.

```python
# This is NOT a DRY violation - different knowledge despite similar code
def validate_user_age(age: int) -> bool:
    return 18 <= age <= 100

def validate_product_rating(rating: int) -> bool:
    return 1 <= rating <= 5

def validate_years_of_experience(years: int) -> bool:
    return 0 <= years <= 50

# These functions have similar structure (checking numeric ranges), but they
# represent completely different business rules:
# - User age has legal requirements (18+) and practical limits (100)
# - Product ratings follow a 1-5 star system  
# - Years of experience starts at 0 with a reasonable upper bound
# Abstracting them would couple unrelated business concepts and make future
# changes harder. What if ratings change to 1-10? What if legal age changes?

# This IS a DRY violation - same knowledge in multiple places
FREE_SHIPPING_THRESHOLD = Decimal("50")  # Knowledge duplicated!
STANDARD_SHIPPING_COST = Decimal("5.99")  # Knowledge duplicated!

class Order:
    def calculate_total(self) -> Decimal:
        items_total = sum(item.price for item in self.items)
        shipping_cost = (
            Decimal("0") if items_total > Decimal("50") else Decimal("5.99")
        )
        return items_total + shipping_cost

class OrderSummary:
    def get_shipping_cost(self, items_total: Decimal) -> Decimal:
        return (
            Decimal("0") if items_total > Decimal("50") else Decimal("5.99")
        )

class ShippingCalculator:
    def calculate(self, order_amount: Decimal) -> Decimal:
        if order_amount > Decimal("50"):
            return Decimal("0")
        return Decimal("5.99")

# Refactored - knowledge in one place
FREE_SHIPPING_THRESHOLD = Decimal("50")
STANDARD_SHIPPING_COST = Decimal("5.99")

def calculate_shipping_cost(items_total: Decimal) -> Decimal:
    return (
        Decimal("0") 
        if items_total > FREE_SHIPPING_THRESHOLD 
        else STANDARD_SHIPPING_COST
    )

# Now all classes use the single source of truth
class Order:
    def calculate_total(self) -> Decimal:
        items_total = sum(item.price for item in self.items)
        return items_total + calculate_shipping_cost(items_total)
```

##### 4. Maintain External APIs During Refactoring

Refactoring must never break existing consumers of your code:

```python
# Original implementation
def process_payment(payment: Payment) -> ProcessedPayment:
    """Process a payment request."""
    # Complex logic all in one function
    if payment.amount <= 0:
        raise ValueError("Invalid amount")
    
    if payment.amount > Decimal("10000"):
        raise ValueError("Amount too large")
    
    # ... 50 more lines of validation and processing
    
    return result

# Refactored - external API unchanged, internals improved
def process_payment(payment: Payment) -> ProcessedPayment:
    """Process a payment request."""
    _validate_payment_amount(payment.amount)
    _validate_payment_method(payment.method)
    
    authorized_payment = _authorize_payment(payment)
    captured_payment = _capture_payment(authorized_payment)
    
    return _generate_receipt(captured_payment)

# New internal functions - not exported (prefixed with _)
def _validate_payment_amount(amount: Decimal) -> None:
    if amount <= 0:
        raise ValueError("Invalid amount")
    
    if amount > Decimal("10000"):
        raise ValueError("Amount too large")

# Tests continue to pass without modification because external API unchanged
```

##### 5. Verify and Commit After Refactoring

**CRITICAL**: After every refactoring:

1. Run all tests - they must pass without modification
2. Run static analysis (mypy, ruff) - must pass
3. Commit the refactoring separately from feature changes

```bash
# After refactoring
poetry run pytest                    # All tests must pass
poetry run mypy .                   # Type checking must pass
poetry run ruff check .             # Linting must pass
poetry run ruff format --check .    # Formatting must be correct

# Only then commit
git add .
git commit -m "refactor: extract payment validation helpers"
```

### Commit Guidelines

- Each commit should represent a complete, working change
- Use conventional commits format:
  ```
  feat: add payment validation
  fix: correct date formatting in payment processor
  refactor: extract payment validation logic
  test: add edge cases for payment validation
  ```
- Include test changes with feature changes in the same commit

### Pull Request Standards

- Every PR must have all tests passing
- All linting and type checking must pass
- Work in small increments that maintain a working state
- PRs should be focused on a single feature or fix
- Include description of the behavior change, not implementation details

## Working with Claude

### Expectations

When working with my Python code:

1. **ALWAYS FOLLOW TDD** - No production code without a failing test. This is not negotiable.
2. **Think deeply** before making any edits
3. **Understand the full context** of the code and requirements
4. **Ask clarifying questions** when requirements are ambiguous
5. **Think from first principles** - don't make assumptions
6. **Assess refactoring after every green** - Look for opportunities to improve code structure, but only refactor if it adds value
7. **Keep project docs current** - update them whenever you introduce meaningful changes

### Code Changes

When suggesting or making changes:

- **Start with a failing test** - always. No exceptions.
- After making tests pass, always assess refactoring opportunities (but only refactor if it adds value)
- After refactoring, verify all tests and static analysis pass, then commit
- Respect the existing patterns and conventions
- Maintain test coverage for all behavior changes
- Keep changes small and incremental
- Ensure all type checking requirements are met
- Use proper Python idioms and patterns
- Provide rationale for significant design decisions

**If you find yourself writing production code without a failing test, STOP immediately and write the test first.**

### Communication

- Be explicit about trade-offs in different approaches
- Explain the reasoning behind significant design decisions
- Flag any deviations from these guidelines with justification
- Suggest improvements that align with these principles
- When unsure, ask for clarification rather than assuming

## Example Patterns

### Error Handling

Use Python's exception system effectively:

```python
# Good - Custom exception hierarchy
class PaymentError(Exception):
    """Base exception for payment-related errors."""
    pass

class PaymentValidationError(PaymentError):
    """Raised when payment validation fails."""
    pass

class InsufficientFundsError(PaymentError):
    """Raised when account has insufficient funds."""
    pass

# Good - Early returns with meaningful exceptions
def process_payment(payment: Payment, account: Account) -> ProcessedPayment:
    if not is_valid_payment(payment):
        raise PaymentValidationError("Payment validation failed")
    
    if not has_sufficient_funds(payment, account):
        raise InsufficientFundsError("Insufficient funds in account")
    
    return execute_payment(payment, account)

# Also good - Result pattern for non-exceptional cases
from typing import Generic, TypeVar
from dataclasses import dataclass

T = TypeVar('T')
E = TypeVar('E', bound=Exception)

@dataclass(frozen=True)
class Success(Generic[T]):
    value: T

@dataclass(frozen=True)
class Failure(Generic[E]):
    error: E

Result = Success[T] | Failure[E]

def process_payment_safe(
    payment: Payment, 
    account: Account
) -> Result[ProcessedPayment, PaymentError]:
    if not is_valid_payment(payment):
        return Failure(PaymentValidationError("Payment validation failed"))
    
    if not has_sufficient_funds(payment, account):
        return Failure(InsufficientFundsError("Insufficient funds"))
    
    try:
        processed = execute_payment(payment, account)
        return Success(processed)
    except Exception as e:
        return Failure(PaymentError(f"Payment execution failed: {e}"))
```

### Testing Behavior

```python
# Good - tests behavior through public API
def test_payment_processor_declines_insufficient_funds():
    """Should decline payment when account has insufficient funds."""
    payment = get_mock_payment_request(amount=Decimal("1000"))
    account = get_mock_account(balance=Decimal("500"))
    
    with pytest.raises(InsufficientFundsError) as exc_info:
        process_payment(payment, account)
    
    assert "Insufficient funds" in str(exc_info.value)

def test_payment_processor_processes_valid_payment():
    """Should process payment successfully when all conditions are met."""
    payment = get_mock_payment_request(amount=Decimal("100"))
    account = get_mock_account(balance=Decimal("500"))
    
    result = process_payment(payment, account)
    
    assert result.status == PaymentStatus.COMPLETED
    assert result.remaining_balance == Decimal("400")

# Good - Parameterized tests for edge cases
@pytest.mark.parametrize("amount,balance,should_succeed", [
    (Decimal("100"), Decimal("500"), True),
    (Decimal("500"), Decimal("500"), True),
    (Decimal("501"), Decimal("500"), False),
    (Decimal("0"), Decimal("500"), False),
])
def test_payment_processing_with_various_amounts(
    amount: Decimal, 
    balance: Decimal, 
    should_succeed: bool
):
    """Test payment processing with various amount/balance combinations."""
    payment = get_mock_payment_request(amount=amount)
    account = get_mock_account(balance=balance)
    
    if should_succeed:
        result = process_payment(payment, account)
        assert result.status == PaymentStatus.COMPLETED
    else:
        with pytest.raises(PaymentError):
            process_payment(payment, account)

# Avoid - testing implementation details
def test_payment_processor_calls_validate_method():
    """This tests implementation, not behavior - AVOID"""
    # This would be testing internal method calls
    pass
```

#### Achieving 100% Coverage Through Business Behavior

Example showing how validation code gets 100% coverage without testing it directly:

```python
# payment_validator.py (implementation detail)
def validate_payment_amount(amount: Decimal) -> bool:
    """Validate payment amount is within acceptable range."""
    return Decimal("0") < amount <= Decimal("10000")

def validate_card_details(card: PayingCardDetails) -> bool:
    """Validate card details format."""
    return (
        re.match(r'^\d{3,4}$', card.cvv) is not None
        and len(card.token) > 0
    )

# payment_processor.py (public API)
def process_payment(request: PaymentRequest) -> ProcessedPayment:
    """Process a payment request with validation."""
    # Validation is used internally but not exposed
    if not validate_payment_amount(request.amount):
        raise PaymentValidationError("Invalid payment amount")
    
    if not validate_card_details(request.paying_card_details):
        raise PaymentValidationError("Invalid card details")
    
    # Process payment...
    return execute_payment(request)

# test_payment_processor.py
class TestPaymentProcessing:
    """Tests achieve 100% coverage of validation code without testing validators directly."""
    
    def test_rejects_negative_amounts(self):
        """Should reject payments with negative amounts."""
        payment = get_mock_payment_request(amount=Decimal("-100"))
        
        with pytest.raises(PaymentValidationError) as exc_info:
            process_payment(payment)
        
        assert "Invalid payment amount" in str(exc_info.value)
    
    def test_rejects_zero_amounts(self):
        """Should reject payments with zero amounts."""
        payment = get_mock_payment_request(amount=Decimal("0"))
        
        with pytest.raises(PaymentValidationError) as exc_info:
            process_payment(payment)
        
        assert "Invalid payment amount" in str(exc_info.value)
    
    def test_rejects_amounts_exceeding_maximum(self):
        """Should reject payments exceeding maximum amount."""
        payment = get_mock_payment_request(amount=Decimal("10001"))
        
        with pytest.raises(PaymentValidationError) as exc_info:
            process_payment(payment)
        
        assert "Invalid payment amount" in str(exc_info.value)
    
    def test_rejects_invalid_cvv_format(self):
        """Should reject payments with invalid CVV format."""
        payment = get_mock_payment_request(
            paying_card_details=get_mock_card_details(cvv="12")
        )
        
        with pytest.raises(PaymentValidationError) as exc_info:
            process_payment(payment)
        
        assert "Invalid card details" in str(exc_info.value)
    
    def test_rejects_empty_card_token(self):
        """Should reject payments with empty card token.""" 
        payment = get_mock_payment_request(
            paying_card_details=get_mock_card_details(token="")
        )
        
        with pytest.raises(PaymentValidationError) as exc_info:
            process_payment(payment)
        
        assert "Invalid card details" in str(exc_info.value)
    
    def test_processes_valid_payments_successfully(self):
        """Should process valid payments successfully."""
        payment = get_mock_payment_request(
            amount=Decimal("100"),
            paying_card_details=get_mock_card_details(cvv="123", token="valid-token")
        )
        
        result = process_payment(payment)
        
        assert result.status == PaymentStatus.COMPLETED
```

### Property-Based Testing with Hypothesis

```python
from hypothesis import given, strategies as st
from decimal import Decimal

# Good - Property-based testing for edge cases
@given(
    amount=st.decimals(
        min_value=Decimal("0.01"), 
        max_value=Decimal("10000"),
        places=2
    )
)
def test_valid_payment_amounts_are_processed(amount: Decimal):
    """Any valid payment amount should be processable."""
    payment = get_mock_payment_request(amount=amount)
    
    # Should not raise an exception
    result = process_payment(payment)
    assert result.amount == amount

@given(
    amount=st.one_of(
        st.decimals(max_value=Decimal("0")),
        st.decimals(min_value=Decimal("10000.01"))
    )
)
def test_invalid_payment_amounts_are_rejected(amount: Decimal):
    """Any invalid payment amount should be rejected."""
    payment = get_mock_payment_request(amount=amount)
    
    with pytest.raises(PaymentValidationError):
        process_payment(payment)
```

## Common Patterns to Avoid

### Anti-patterns

```python
# Avoid: Mutable default arguments
def add_item(items: list[str] = []) -> list[str]:  # DANGEROUS!
    items.append("new_item")
    return items

# Good: Use None and create new list
def add_item(items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    return [*items, "new_item"]

# Avoid: Using bare except
try:
    process_payment(payment)
except:  # Too broad!
    handle_error()

# Good: Catch specific exceptions
try:
    process_payment(payment)
except (PaymentValidationError, InsufficientFundsError) as e:
    handle_payment_error(e)
except Exception as e:
    logger.exception("Unexpected error during payment processing")
    raise

# Avoid: String formatting with % or .format()
name = "John"
message = "Hello, %s!" % name  # Old style
message = "Hello, {}!".format(name)  # Also old

# Good: Use f-strings
message = f"Hello, {name}!"

# Avoid: Manual iteration when comprehensions work
result = []
for item in items:
    if item.is_valid():
        result.append(item.process())

# Good: Use comprehensions
result = [item.process() for item in items if item.is_valid()]

# Avoid: Checking type with isinstance for duck typing
def process_items(items):
    if isinstance(items, list):
        # Process as list
    elif isinstance(items, dict):
        # Process as dict

# Good: Use Protocol or duck typing
from typing import Protocol

class Processable(Protocol):
    def process(self) -> ProcessedResult: ...

def process_items(items: Processable) -> ProcessedResult:
    return items.process()
```

## Modern Python Tools

### Essential Tools Configuration

```toml
# pyproject.toml
[tool.poetry]
name = "your-project"
version = "0.1.0"
description = ""
authors = ["Your Name <you@example.com>"]
readme = "README.md"
packages = [{include = "your_project", from = "src"}]

[tool.poetry.dependencies]
python = "^3.12"
pydantic = "^2.0.0"
httpx = "^0.24.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.0.0"
pytest-mock = "^3.0.0"
hypothesis = "^6.0.0"
mypy = "^1.0.0"
ruff = "^0.1.0"
coverage = {extras = ["toml"], version = "^7.0.0"}

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_incomplete_defs = true

[tool.ruff]
target-version = "py312"
line-length = 88

[tool.ruff.lint]
select = [
    "E",   # pycodestyle errors
    "W",   # pycodestyle warnings
    "F",   # pyflakes
    "I",   # isort
    "B",   # flake8-bugbear
    "C4",  # flake8-comprehensions
    "UP",  # pyupgrade
]

[tool.coverage.run]
source = ["src"]
branch = true

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "--cov=src --cov-report=html --cov-report=term-missing --cov-fail-under=100"
```

### Development Workflow Commands

```bash
# Install dependencies
poetry install

# Activate virtual environment
poetry shell

# Type checking
poetry run mypy .

# Linting and formatting
poetry run ruff check .
poetry run ruff format .

# Testing with coverage
poetry run pytest

# All checks in one command
poetry run mypy . && poetry run ruff check . && poetry run ruff format --check . && poetry run pytest

# Add new dependencies
poetry add package-name

# Add development dependencies
poetry add --group dev package-name
```

## Resources and References

- [Python Official Documentation](https://docs.python.org/3/)
- [PEP 8 - Style Guide for Python Code](https://pep8.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [pytest Documentation](https://docs.pytest.org/)
- [mypy Documentation](https://mypy.readthedocs.io/)
- [Hypothesis Documentation](https://hypothesis.readthedocs.io/)
- [The Zen of Python](https://peps.python.org/pep-0020/)

## Summary

The key is to write clean, testable, Pythonic code that evolves through small, safe increments. Every change should be driven by a test that describes the desired behavior, and the implementation should be the simplest thing that makes that test pass. Leverage Python's strengths: readability, expressiveness, and powerful standard library. When in doubt, favor simplicity and clarity over cleverness, and always remember that code is read far more often than it is written.

