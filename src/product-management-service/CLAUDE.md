# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Go-based serverless Product Management Service built for AWS, featuring multiple deployment options (AWS CDK, SAM, Terraform) and comprehensive Datadog instrumentation. The service manages product catalogs with CRUD operations and event-driven architecture.

## Architecture

The service consists of 3 main components:
1. **ProductAPI** - REST API for CRUD operations with Lambda functions
2. **ProductACL** - Anti-corruption layer for external event translation
3. **ProductEventPublisher** - Translation layer between private and public events

Key directories:
- `src/core/` - Core business logic and domain models
- `src/product-api/` - API Lambda functions (create, read, update, delete, list)
- `src/product-acl/` - Event handlers for external system integration
- `src/product-event-publisher/` - Public event publishing
- `src/integration-tests/` - Integration test suite
- `cdk/` - AWS CDK infrastructure as code (Go)
- `infra/` - Terraform infrastructure as code
- `template.yaml` - AWS SAM template

## Common Commands

### Testing
```bash
make unit-test          # Run core unit tests
make integration-test   # Run integration tests
```

### Building
```bash
make build             # Build all Lambda functions and create ZIP packages
make cleanup           # Clean build artifacts
```

### Deployment Options

**AWS CDK (recommended):**
```bash
make cdk-deploy        # Deploy using CDK
make cdk-destroy       # Destroy CDK resources
```

**AWS SAM:**
```bash
make sam              # Build and deploy with SAM
make sam-destroy      # Destroy SAM resources
```

**Terraform:**
```bash
make tf-apply         # Deploy with Terraform (requires TF_STATE_BUCKET_NAME)
make tf-apply-local   # Deploy with local state
make tf-destroy       # Destroy Terraform resources
```

## Required Environment Variables

- `DD_API_KEY` - Datadog API key
- `DD_SITE` - Datadog site (e.g., datadoghq.com)
- `AWS_REGION` - AWS deployment region
- `ENV` - Environment suffix (defaults to "dev")
- `COMMIT_HASH` - Version identifier
- `TF_STATE_BUCKET_NAME` - S3 bucket for Terraform state (Terraform only)

## Go Modules Structure

The project uses multiple Go modules:
- `src/core/` - Core business logic with Datadog tracing
- `src/product-api/` - API handlers
- `src/product-acl/` - Anti-corruption layer
- `src/product-event-publisher/` - Event publishing
- `src/integration-tests/` - Integration tests
- `src/observability/` - Shared observability utilities
- `cdk/` - CDK infrastructure code

## Lambda Function Architecture

Functions are built for ARM64 architecture and use the `provided.al2023` runtime. All functions include:
- Datadog extension layer for observability
- Cold start tracing enabled
- Lambda payload capture enabled
- Custom bootstrap binary as entry point

## Datadog Integration

The service includes comprehensive Datadog instrumentation:
- Distributed tracing with `gopkg.in/DataDog/dd-trace-go.v1`
- Custom spans: `tracer.StartSpanWithContext(ctx, "operation.name")`
- Logs sent directly via Datadog extension (CloudWatch disabled)
- Performance monitoring and error tracking

## Development Notes

- Build process compiles Go to ARM64 Linux binaries
- ZIP packaging includes bootstrap executable
- Each Lambda function has its own build target
- Integration tests require deployed infrastructure
- Core module contains shared business logic and domain models