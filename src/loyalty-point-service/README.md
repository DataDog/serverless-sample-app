# Loyalty Point Service

**Runtime:** Node.js 22 (TypeScript)

**AWS Services:** API Gateway, Lambda (with Durable Execution), SQS, DynamoDB (with Streams), EventBridge

## What This Service Does

The loyalty point service manages user loyalty accounts and points. It reacts to events from other services and exposes an API for querying and spending points.

**Components:**

1. **API** -- REST endpoints for retrieving a user's loyalty account (`GET /loyalty`) and spending points (`POST /loyalty`). Both endpoints require a JWT bearer token whose `sub` claim identifies the user.
2. **ACL (Anti-Corruption Layer)** -- Consumes `users.userCreated.v1` and `orders.orderCompleted.v1`/`v2` events from EventBridge via SQS queues, translates them into internal operations (create account with 100 points, add 50 points per completed order).
3. **Stream Handler** -- Listens to DynamoDB Streams on the loyalty table and publishes `loyalty.pointsAdded.v2` events to EventBridge whenever a user's point total changes.
4. **Tier Upgrade Workflow** -- A durable multi-step workflow (using AWS Lambda Durable Execution) that evaluates whether a user has crossed a loyalty tier threshold and, if so, gathers context, saves the new tier, publishes a notification event, and waits for external acknowledgement before completing.

### Architecture

```
EventBridge ──> SQS ──> HandleUserCreated Lambda ──> DynamoDB
EventBridge ──> SQS ──> HandleOrderCompleted Lambda ──> DynamoDB
                                                          │
                                                    DynamoDB Stream
                                                          │
                                            HandleLoyaltyPointsUpdated Lambda ──> EventBridge (loyalty.pointsAdded.v2)
                                                                                        │
                                                          ┌─────────────────────────────┘
                                                          ▼
                                             SQS ──> TierUpgradeTrigger Lambda
                                                          │ (async invoke)
                                                          ▼
                                             TierUpgradeOrchestrator Lambda (Durable)
                                              │   │   │   │
                                              │   │   │   └── wait for callback ──> EventBridge (loyalty.tierUpgraded.v1)
                                              │   │   │                                    │
                                              │   │   │                        SQS ──> NotificationAcknowledger Lambda
                                              │   │   │                                    │ (SendDurableExecutionCallbackSuccess)
                                              │   │   │                                    └──────────────────────────────────────┐
                                              │   │   └── context.invoke ──> FetchOrderHistoryActivity Lambda                    │
                                              │   └── context.step ──> Product Service (HTTP)                                    │
                                              └── context.step ──> DynamoDB (read/write tier)  <──────────────────────────────────┘

API Gateway ──> GetLoyaltyPoints Lambda ──> DynamoDB
API Gateway ──> SpendLoyaltyPoints Lambda ──> DynamoDB
```

## Loyalty Tier Upgrade Workflow

This is the most complex component of the service. It uses [AWS Lambda Durable Execution](https://docs.aws.amazon.com/lambda/latest/dg/durable-execution.html) via the `@aws/durable-execution-sdk-js` package to run a stateful, multi-step workflow entirely within Lambda — no Step Functions required.

### What it does

When a user's loyalty points are updated, the workflow evaluates whether they have crossed a tier threshold and, if so, runs the following steps in order:

| Step | Description |
|---|---|
| `read-account` | Reads the user's current tier and version from DynamoDB |
| `evaluate-tier` | Computes the new tier based on current points (Bronze → Silver → Gold → Platinum) |
| `gather-context` (parallel) | Fetches product recommendations from the Product Service and Product Search Service simultaneously |
| `fetch-order-history` | Invokes the `FetchOrderHistoryActivity` Lambda (pinned to a specific version) to retrieve the user's order history from the Order Service |
| `upgrade-tier` | Writes the new tier to DynamoDB with optimistic locking (conditional write on `TierVersion`) |
| `await-notification-ack` | Publishes a `loyalty.tierUpgraded.v1` event to EventBridge and suspends execution, waiting up to 5 minutes for an acknowledgement callback |
| `record-completion` | Marks the tier record as notified in DynamoDB |

If the user has not yet reached the next tier threshold, the workflow exits early after `evaluate-tier` with no writes or events.

### Tier thresholds

| Tier | Points required |
|---|---|
| Bronze | 0 (default) |
| Silver | 500 |
| Gold | 1500 |
| Platinum | 3000 |

Tiers only upgrade — a decrease in points (hypothetically) will not trigger a downgrade.

### Idempotency

Optimistic locking on `TierVersion` in DynamoDB prevents duplicate upgrades. If a `ConditionalCheckFailedException` is thrown at the `upgrade-tier` step (e.g., because multiple `loyalty.pointsAdded.v2` events fired concurrently), the write is rejected and the workflow stops. Durable execution's built-in replay semantics ensure completed steps are never re-executed.

### How the callback works

After publishing the `loyalty.tierUpgraded.v1` event, the orchestrator suspends using `context.waitForCallback`. The event payload includes a `callbackId`. A separate `NotificationAcknowledger` Lambda subscribes to `loyalty.tierUpgraded.v1` via SQS and calls the Lambda `SendDurableExecutionCallbackSuccess` API with that `callbackId`, which resumes the suspended orchestrator.

### Lambda functions

| Function | CDK construct ID | Purpose |
|---|---|---|
| `TierUpgradeTrigger` | `LoyaltyTierWorkflow/TierUpgradeTrigger` | SQS consumer that receives `loyalty.pointsAdded.v2` and asynchronously invokes the orchestrator |
| `TierUpgradeOrchestrator` | `LoyaltyTierWorkflow/TierUpgradeOrchestrator` | Durable workflow function; orchestrates all steps |
| `FetchOrderHistoryActivity` | `LoyaltyTierWorkflow/FetchOrderHistoryActivity` | Activity Lambda invoked by the orchestrator to call the Order Service |
| `NotificationAcknowledger` | `LoyaltyTierWorkflow/NotificationAcknowledger` | SQS consumer that receives `loyalty.tierUpgraded.v1` and sends the durable callback |

### Configuration

The following SSM Parameter Store values must exist before deploying (they are read at runtime, not synthesis):

| SSM Parameter | Consumer function | Description |
|---|---|---|
| `/<ENV>/shared/secret-access-key` | `FetchOrderHistoryActivity` | JWT signing secret shared with the Order Service |
| `/<ENV>/OrderService/api-endpoint` | `FetchOrderHistoryActivity` | Base URL of the Order Service API |
| `/<ENV>/ProductService/api-endpoint` | `TierUpgradeOrchestrator` | Base URL of the Product Service API |
| `/<ENV>/ProductSearchService/api-endpoint` | `TierUpgradeOrchestrator` | Base URL of the Product Search Service API |

The orchestrator function also requires these IAM actions (granted automatically by the CDK construct):

- `lambda:CheckpointDurableExecution` — to save and replay workflow state
- `lambda:GetDurableExecutionState` — to read current workflow state on replay
- `lambda:SendDurableExecutionCallbackSuccess` / `lambda:SendDurableExecutionCallbackFailure` — granted to the `NotificationAcknowledger` to resume the suspended orchestrator

### SDK version requirement

`SendDurableExecutionCallbackSuccessCommand` requires `@aws-sdk/client-lambda >= 3.1004.0`. This is declared as a `devDependency` in `package.json` and is included in the bundled Lambda deployment packages via esbuild.

### Source layout

```
src/loyalty-tier-workflow/
├── trigger/                    # TierUpgradeTrigger handler + esbuild config
├── orchestrator/               # TierUpgradeOrchestrator handler + esbuild config
├── activities/                 # FetchOrderHistoryActivity handler + esbuild config
├── acknowledger/               # NotificationAcknowledger handler + esbuild config
└── core/
    ├── tier.ts                 # Tier enum, thresholds, and evaluateTierChange logic
    ├── tierRepository.ts       # TierRepository interface
    └── adapters/
        ├── dynamoDbTierRepository.ts   # DynamoDB read/write with optimistic locking
        ├── eventBridgeTierPublisher.ts # Publishes loyalty.tierUpgraded.v1
        ├── orderServiceClient.ts       # HTTP client for Order Service
        ├── productServiceClient.ts     # HTTP client for Product Service
        └── productSearchClient.ts      # HTTP client for Product Search Service
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
│   ├── loyalty-api/            # CDK stack definitions (API, ACL, props)
│   └── loyalty-tier-workflow/  # CDK construct for the durable tier upgrade workflow
├── src/
│   ├── loyalty-api/
│   │   ├── adapters/           # Lambda handler entry points and infrastructure adapters
│   │   └── core/               # Domain logic, DTOs, event definitions
│   ├── loyalty-tier-workflow/
│   │   ├── trigger/            # TierUpgradeTrigger handler + esbuild config
│   │   ├── orchestrator/       # TierUpgradeOrchestrator (durable) handler + esbuild config
│   │   ├── activities/         # FetchOrderHistoryActivity handler + esbuild config
│   │   ├── acknowledger/       # NotificationAcknowledger handler + esbuild config
│   │   └── core/               # Tier domain logic, repository interface, and adapters
│   └── observability/          # Shared tracing and DSM helpers
├── tests/
│   └── loyalty-service-tests/  # Integration tests (including tier upgrade workflow tests)
├── infra/                      # Terraform configuration
├── template.yaml               # SAM template
├── serverless.yml              # Serverless Framework config
├── sst.config.ts               # SST configuration
├── package.sh                  # Build script for SAM/Terraform deployments
├── Makefile                    # Shortcuts for build, deploy, and destroy
└── cdk.json                    # CDK project configuration
```