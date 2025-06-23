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

## Development Guidelines

**Code Quality Tools:**
- Ruff for formatting and linting (line length: 150, Python 3.13)
- MyPy for static type checking
- Pre-commit hooks for automated checks
- CDK NAG for security/compliance scanning

**Key Files:**
- `app.py` - CDK app entry point
- `pyproject.toml` - Poetry configuration and tool settings
- `Makefile` - Development workflow commands
- `generate_openapi.py` - OpenAPI documentation generator

**Observability Features:**
- AWS Lambda Powertools integration
- Structured logging and tracing
- CloudWatch monitoring
- X-Ray distributed tracing
