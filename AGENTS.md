# AGENTS.md

## Project Overview

This is a polyglot serverless microservices application running on AWS and observed with Datadog. It demonstrates best practices for building, deploying, and observing event-driven serverless systems across **six programming languages**. All services communicate asynchronously via a shared Amazon EventBridge bus and use Amazon SQS for reliable delivery.

## Repository Layout

```
src/
├── activity-service/          # Python — activity feed from domain events
├── inventory-service/         # Java (Quarkus) — stock management + ordering workflow
├── loyalty-point-service/     # TypeScript — loyalty accounts, points, tier upgrades
├── order-service/             # C# (.NET 9) — order placement + Step Functions workflow
├── pricing-service/           # TypeScript — premium user pricing
├── product-management-service/# Go — product catalogue CRUD + event publishing
├── product-search-service/    # Python — AI-powered semantic search (Bedrock + S3 Vectors)
├── user-management-service/   # Rust — user accounts, auth, JWT/OAuth2
├── demo-reset-service/        # TypeScript — demo data reset utility
├── order-mcp/                 # TypeScript — MCP server exposing order/product tools for AI agents
├── shared-infra/              # TypeScript CDK — shared EventBridge bus + SSM params
└── frontend/                  # JavaScript — static SPA with Datadog RUM
```

## Service Summary

| Service | Language | Build Tool | AWS Compute | Data Store | IaC Options |
|---|---|---|---|---|---|
| activity-service | Python 3.13 | Poetry / Make | Lambda | DynamoDB | CDK, Terraform, SAM |
| inventory-service | Java | Maven | Lambda, ECS/Fargate | DynamoDB | CDK, Terraform, SAM |
| loyalty-point-service | TypeScript | npm | Lambda (Durable Execution) | DynamoDB + Streams | CDK, SST, SAM |
| order-service | C# (.NET 9) | dotnet CLI | Lambda, ECS/Fargate | DynamoDB | CDK, Terraform, SAM |
| pricing-service | TypeScript | npm | Lambda | DynamoDB | CDK, SST, SAM |
| product-management-service | Go | Make | Lambda | Aurora DSQL | CDK, Terraform, SAM |
| product-search-service | Python | Poetry | Lambda | DynamoDB, S3 Vectors | CDK, SAM |
| user-management-service | Rust | Cargo | Lambda | DynamoDB | CDK, SAM |

## Architecture Patterns

- **Event backbone**: Amazon EventBridge is the central bus. Every service publishes domain events and consumes others' events through SQS subscriptions.
- **Anti-Corruption Layer (ACL)**: Most services have a dedicated ACL component that translates external events into internal domain commands.
- **Private → Public event translation**: Services emit private internal events, then a separate publisher function translates them to public events on EventBridge.
- **Service discovery**: SSM Parameter Store is used to share resource ARNs (event bus, API endpoints, table names) between independently deployed CDK stacks.
- **Step Functions**: Used by `order-service` and `inventory-service` for multi-step workflows.
- **Durable Execution**: `loyalty-point-service` uses the AWS Lambda Durable Execution SDK for the tier upgrade workflow (no Step Functions).

## Observability (Datadog)

Every service is instrumented with Datadog. Key observability features demonstrated:

- **Distributed tracing** with automatic trace propagation through async message channels
- **Span Links** (preferred over parent-child for async flows) to connect producer and consumer traces
- **OpenTelemetry Semantic Conventions** for messaging spans
- **Data Streams Monitoring (DSM)** for pipeline latency and throughput
- **LLM Observability** in the product-search-service (Bedrock calls)
- **Real User Monitoring (RUM)** in the frontend
- **Custom metrics and traces** via Datadog Lambda extension

## Building

Each service has its own build process. To build everything:

```sh
./build-all.sh
```

Individual service builds:

| Service | Command |
|---|---|
| activity-service | `cd src/activity-service && make dev && make deps && make build` |
| inventory-service | `cd src/inventory-service && mvn clean package -DskipTests` |
| loyalty-point-service | `cd src/loyalty-point-service && npm i && ./package.sh` |
| order-service | `cd src/order-service && dotnet restore` |
| pricing-service | `cd src/pricing-service && npm i && ./package.sh` |
| product-management-service | `cd src/product-management-service && make build` |
| product-search-service | `cd src/product-search-service && npm i && ./package.sh` |
| user-management-service | `cd src/user-management-service && npm i && ./package.sh` |

## Deploying

All services deploy via AWS CDK. A Docker-based build image is available with all prerequisites installed.

```sh
# Deploy everything (CDK)
./cdk-deploy-all.sh

# Required environment variables
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...
export AWS_REGION=...
export ENV=...
export DD_API_KEY=...
export DD_SITE=...
```

**Deploy order**: `shared-infra` must be deployed first — all other services depend on its SSM parameters. After that, services can deploy in parallel.

## Testing

Services with CLAUDE.md files enforce strict TDD. Testing patterns vary by language:

| Service | Framework | Command |
|---|---|---|
| activity-service | pytest | `cd src/activity-service && make unit-test` |
| inventory-service | JUnit (Maven) | `cd src/inventory-service && mvn test` |
| loyalty-point-service | Jest | `cd src/loyalty-point-service && npm test` |
| order-service | xUnit + Testcontainers | `cd src/order-service && dotnet test` |
| pricing-service | Jest | `cd src/pricing-service && npm test` |
| product-management-service | Go test | `cd src/product-management-service && make unit-test` |
| product-search-service | pytest | `cd src/product-search-service && make unit-test` |
| user-management-service | cargo test + rstest | `cd src/user-management-service && cargo test` |

## Key Conventions

1. **One service per CloudFormation stack** — services are independently deployable.
2. **Layered architecture** within each service: handlers → business logic → data access → models.
3. **No cross-service runtime dependencies** — all communication is async via EventBridge/SQS.
4. **Infrastructure as Code lives alongside application code** in `cdk/`, `infra/`, or `lib/` directories.
5. **Each service has its own README** with language-specific setup and configuration details.
6. **Behavior-driven tests** — tests verify observable behavior, not implementation details.
