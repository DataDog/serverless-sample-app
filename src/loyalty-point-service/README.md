# Loyalty Point Service

**Runtime:** Node.js 22 (TypeScript)

**AWS Services:** API Gateway, Lambda, SQS, DynamoDB (with Streams), EventBridge

## What This Service Does

The loyalty point service manages user loyalty accounts and points. It reacts to events from other services and exposes an API for querying and spending points.

**Components:**

1. **API** -- REST endpoints for retrieving a user's loyalty account (`GET /loyalty`) and spending points (`POST /loyalty`). Both endpoints require a JWT bearer token whose `sub` claim identifies the user.
2. **ACL (Anti-Corruption Layer)** -- Consumes `users.userCreated.v1` and `orders.orderCompleted.v1`/`v2` events from EventBridge via SQS queues, translates them into internal operations (create account with 100 points, add 50 points per completed order).
3. **Stream Handler** -- Listens to DynamoDB Streams on the loyalty table and publishes `loyalty.loyaltyPointsUpdated` events to EventBridge.

### Architecture

```
EventBridge ──> SQS ──> HandleUserCreated Lambda ──> DynamoDB
EventBridge ──> SQS ──> HandleOrderCompleted Lambda ──> DynamoDB
                                                          │
                                                    DynamoDB Stream
                                                          │
                                                  HandleLoyaltyPointsUpdated Lambda ──> EventBridge
API Gateway ──> GetLoyaltyPoints Lambda ──> DynamoDB
API Gateway ──> SpendLoyaltyPoints Lambda ──> DynamoDB
```

## Prerequisites

- Node.js >= 22
- npm
- AWS CLI configured with appropriate credentials
- One of: AWS CDK, AWS SAM CLI, Terraform, Serverless Framework, or SST v2

### Environment Variables (all deployment methods)

| Variable | Description |
|---|---|
| `DD_API_KEY` or `DD_API_KEY_SECRET_ARN` | Datadog API key (plain text or Secrets Manager ARN, depending on tool) |
| `DD_SITE` | Datadog site (e.g. `datadoghq.com`, `datadoghq.eu`) |
| `AWS_REGION` | AWS region to deploy to |
| `ENV` | Environment name (e.g. `dev`, `prod`, or a personal stage name) |

## Local Development

```sh
npm install
npm run build        # Compile TypeScript
npm run typecheck    # Type-check without emitting
npm run watch        # Watch mode for TypeScript compilation
```

## Testing

The project includes integration tests that deploy against a live AWS environment. Tests exercise the full event-driven flow: creating a user, completing an order, and verifying loyalty point totals via the API.

Tests auto-discover the API endpoint and EventBridge bus name from SSM Parameter Store (`/<ENV>/LoyaltyService/api-endpoint` and `/<ENV>/shared/event-bus-name`). You can override these by setting `API_ENDPOINT` and `EVENT_BUS_NAME` environment variables.

```sh
npm run test
```

## Deployment

The service supports five deployment tools. Each deploys the same set of Lambda functions, DynamoDB table, SQS queues, EventBridge rules, and API Gateway.

### AWS CDK (recommended)

The CDK stack is in `lib/loyalty-api/` with a custom [`InstrumentedFunction` L3 construct](./lib/constructs/lambdaFunction.ts) that ensures consistent Datadog instrumentation via the [Datadog CDK Construct](https://docs.datadoghq.com/serverless/libraries_integrations/cdk/).

Entry point: `bin/loyalty-point-service.ts`

#### Deploy

```sh
export DD_API_KEY=<YOUR_DATADOG_API_KEY>
export DD_SITE=<YOUR_DATADOG_SITE>
export ENV=dev
cdk deploy --all --require-approval never
```

Or using the Makefile:

```sh
export DD_API_KEY=<YOUR_DATADOG_API_KEY>
export DD_SITE=<YOUR_DATADOG_SITE>
export ENV=dev
export AWS_REGION=us-east-1
make cdk-deploy
```

#### Cleanup

```sh
cdk destroy --all --force
```

### AWS SAM

Uses the [Datadog CloudFormation Macro](https://docs.datadoghq.com/serverless/libraries_integrations/macro/) for auto-instrumentation. Ensure the macro is installed in your account before deploying.

Template: `template.yaml`

Before deploying with SAM, build the Lambda deployment packages:

```sh
./package.sh
```

#### Deploy

```sh
export DD_API_KEY=<YOUR_DATADOG_API_KEY>
export DD_SITE=<YOUR_DATADOG_SITE>
export ENV=dev
export AWS_REGION=us-east-1
make sam
```

Or directly:

```sh
sam build
sam deploy --stack-name LoyaltyService-dev \
  --parameter-overrides ParameterKey=DDApiKey,ParameterValue="$DD_API_KEY" ParameterKey=DDSite,ParameterValue="$DD_SITE" \
  --resolve-s3 --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --region $AWS_REGION
```

#### Cleanup

```sh
make sam-destroy
```

### Terraform

Terraform requires pre-built ZIP artifacts. The `package.sh` script transpiles TypeScript via esbuild and creates ZIP files in the `out/` directory.

Configuration is in `infra/`, using a custom [`lambda_function` module](./infra/modules/lambda-function/main.tf) that wraps the [Datadog Lambda Terraform module](https://registry.terraform.io/modules/DataDog/lambda-datadog/aws/latest).

#### Deploy

1. Build deployment packages:

    ```sh
    ./package.sh
    ```

2. Create `infra/dev.tfvars`:

    ```hcl
    dd_api_key  = "<YOUR_DATADOG_API_KEY>"
    dd_site     = "<YOUR_DATADOG_SITE>"
    env         = "dev"
    region      = "us-east-1"
    ```

3. Deploy:

    ```sh
    export ENV=dev
    export AWS_REGION=us-east-1
    make tf-apply-local
    ```

    For remote state, set `TF_STATE_BUCKET_NAME` and use `make tf-apply` instead.

#### Cleanup

```sh
make tf-destroy
```

### Serverless Framework

Uses the [Datadog Serverless Plugin](https://www.serverless.com/plugins/serverless-plugin-datadog). Configuration is in `serverless.yml`.

> **Note:** The `serverless.yml` in this repo is configured for a product API service, not the loyalty service. It is included as a reference for the Serverless Framework deployment pattern.

#### Deploy

```sh
export DD_API_KEY_SECRET_ARN=<YOUR_SECRET_ARN>
export DD_SITE=<YOUR_DATADOG_SITE>
export AWS_REGION=us-east-1
serverless deploy --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION}
```

#### Cleanup

```sh
serverless remove --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION}
```

### SST (Serverless Stack v2)

Uses [SST v2](https://docs.sst.dev/what-is-sst) with AWS CDK under the hood. Configuration is in `sst.config.ts`, which reuses the same CDK stack definitions.

#### Local Development (SST Live Lambda)

```sh
export DD_API_KEY=<YOUR_DATADOG_API_KEY>
export DD_SITE=<YOUR_DATADOG_SITE>
npm run dev:sst
```

This runs Lambda functions locally while interacting with remote AWS resources. Use the API URL printed on the terminal for testing.

#### Deploy to AWS

```sh
npm run deploy:sst
```

#### Cleanup

```sh
npm run remove:sst            # Remove dev stage
npm run remove:sst:personal   # Remove personal stage
```

## Observability

The service demonstrates several Datadog observability patterns for asynchronous, event-driven architectures.

### Span Links

Instead of creating deep parent-child trace hierarchies across service boundaries, this service uses [Span Links](https://docs.datadoghq.com/tracing/trace_collection/span_links/) to connect causally related spans. See [`src/observability/observability.ts`](./src/observability/observability.ts) for the implementation.

This requires disabling automatic trace propagation on the consumer Lambda functions:

```
DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT=none
DD_TRACE_PROPAGATION_STYLE_EXTRACT=false
```

### OpenTelemetry Semantic Conventions

Message processing and publishing spans follow the [OTel Semantic Conventions for Messaging](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/), including attributes like `messaging.system`, `messaging.operation.type`, `messaging.message.type`, and `messaging.destination.name`.

### Datadog Data Streams Monitoring

[Data Streams Monitoring (DSM)](https://docs.datadoghq.com/data_streams/) checkpoints are recorded manually for both consume and produce paths, since DSM does not automatically support all messaging transports. See the `setConsumeCheckpoint` and `setProduceCheckpoint` calls in [`observability.ts`](./src/observability/observability.ts).

## Project Structure

```
.
├── bin/                        # CDK app entry point
├── lib/
│   ├── constructs/             # Reusable CDK constructs (InstrumentedFunction, ResilientQueue)
│   └── loyalty-api/            # CDK stack definitions (API, ACL, props)
├── src/
│   ├── loyalty-api/
│   │   ├── adapters/           # Lambda handler entry points and infrastructure adapters
│   │   └── core/               # Domain logic, DTOs, event definitions
│   └── observability/          # Shared tracing and DSM helpers
├── tests/
│   └── loyalty-service-tests/  # Integration tests
├── infra/                      # Terraform configuration
├── template.yaml               # SAM template
├── serverless.yml              # Serverless Framework config
├── sst.config.ts               # SST configuration
├── package.sh                  # Build script for SAM/Terraform deployments
├── Makefile                    # Shortcuts for build, deploy, and destroy
└── cdk.json                    # CDK project configuration
```
