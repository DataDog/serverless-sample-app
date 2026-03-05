# Pricing Service

**Runtime: NodeJS**

**AWS Services Used: API Gateway, Lambda, SQS, DynamoDB, EventBridge**

The pricing service generates custom pricing breakdowns that are available to premium users.

1. The `Api` provides a single endpoint to generate pricing for a specific product synchronously
2. The `PricingEventHandlers` service is an [anti-corruption layer](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer) that consumes Product Created and Updated events, generates pricing, and then publishes a PricingGenerated event back onto the event bus

## Testing

The repo includes an integration test that hits all 4 of the CRUD API endpoints. If you have deployed all of the backend services, running this test will give you the full set of end to end traces. The integration test dynamically loads the API endpoint from an SSM parameter named `/node/product/api-endpoint`. If you need to override the API endpoint you are testing against, set the environment variable named `API_ENDPOINT`.

```sh
npm run test -- product-service
```

## AWS CDK

The [Datadog CDK Construct](https://docs.datadoghq.com/serverless/libraries_integrations/cdk/) simplifies Datadog instrumentation. It is configured in [`lib/pricing-api/pricingApiStack.ts`](./lib/pricing-api/pricingApiStack.ts) and passed down to individual Lambda functions via `SharedProps`:

```typescript
const datadogConfiguration = new DatadogLambda(this, "Datadog", {
  nodeLayerVersion: 130,
  extensionLayerVersion: 90,
  site: process.env.DD_SITE ?? "datadoghq.com",
  apiKeySecret: ddApiKey,
  service,
  version,
  env,
  enableColdStartTracing: true,
  enableDatadogTracing: true,
  captureLambdaPayload: true,
});
```

Each Lambda function is then registered with the construct using `addLambdaFunctions`, which attaches the Datadog Lambda layer and extension, and injects the required environment variables automatically.

The stack also stores its API endpoint in SSM Parameter Store so that integration tests and other services can discover it at runtime:

```typescript
new StringParameter(this, "PricingAPIEndpoint", {
  parameterName: `/${env}/PricingService/api-endpoint`,
  stringValue: api.api.url,
});
```

### Deploy

```sh
make cdk-deploy
```

### Cleanup

```sh
make cdk-destroy
```

## AWS SAM

The AWS SAM example leverages the Datadog CloudFormation Macro. The macro auto-instruments your Lambda functions at the point of deployment. Ensure you have followed the [installation instructions](https://docs.datadoghq.com/serverless/libraries_integrations/macro/) before continuing with the SAM deployment.

Ensure you have set the below environment variables before starting deployment:

- `DD_API_KEY_SECRET_ARN`: The Secrets Manager Secret ARN holding your Datadog API Key
- `DD_SITE`: The Datadog Site to use
- `AWS_REGION`: The AWS region you want to deploy to

Once both environment variables are set, use the below `sh` script to deploy all backend services. You can deploy individual services as well if required. Due to the SSM parameters holding SNS Topic ARN's, the order of deployment is important.

### Deploy

The `template.yaml` file contains an example of using a nested stack to deploy all 6 backend services in a single command. This **is not** recommended for production use cases, instead preferring independent deployments. For the purposes of this demonstration, a single template makes test deployments easier.

```sh
sam build
sam deploy --stack-name NodeTracing --parameter-overrides ParameterKey=DDApiKeySecretArn,ParameterValue="$DD_API_KEY_SECRET_ARN" ParameterKey=DDSite,ParameterValue="$DD_SITE" --resolve-s3 --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --region $AWS_REGION
```

### Cleanup

Use the below `sh` script to cleanup resources deployed with AWS SAM.

```sh
sam delete --stack-name NodeInventoryOrderingService --region $AWS_REGION --no-prompts &&
sam delete --stack-name NodeInventoryAcl --region $AWS_REGION --no-prompts &&
sam delete --stack-name NodeProductApiWorkerStack --region $AWS_REGION --no-prompts &&
sam delete --stack-name NodeProductPublicEventPublisherStack --region $AWS_REGION --no-prompts &&
sam delete --stack-name NodeProductPricingServiceStack --region $AWS_REGION --no-prompts &&
sam delete --stack-name NodeProductApiStack --region $AWS_REGION --no-prompts &&
sam delete --stack-name NodeSharedStack --region $AWS_REGION --no-prompts
```

## Terraform

Terraform does not natively support transpiling Typescript into JS code. When deploying with Typescript, you first need to transpile and ZIP up the typescript code. The [`deploy.sh`](./deploy.sh) script performs this action. Iterating over all of the `build*.js` files and running esbuild before zipping up all folders in the output folder.

### Configuration

A customer [`lambda_function`](./infra/modules/lambda-function/main.tf) module is used to group together all the functionality for deploying Lambda functions. This handles the creation of the CloudWatch Log Groups, and default IAM roles.

The Datadog Lambda Terraform module is used to create and configure the Lambda function with the required extensions, layers and configurations.

> **IMPORTANT!** If you are using AWS Secrets Manager to hold your Datadog API key, ensure your Lambda function has permissions to call the `secretsmanager:GetSecretValue` IAM action.

```terraform
module "aws_lambda_function" {
  source  = "DataDog/lambda-datadog/aws"
  version = "1.3.0"

  filename                 = var.zip_file
  function_name            = var.function_name
  role                     = aws_iam_role.lambda_function_role.arn
  handler                  = var.lambda_handler
  runtime                  = "nodejs22.x"
  memory_size              = 512
  logging_config_log_group = aws_cloudwatch_log_group.lambda_log_group.name
  source_code_hash = "${filebase64sha256(var.zip_file)}"
  timeout = 29

  environment_variables = merge(tomap({
    "DD_API_KEY_SECRET_ARN" : var.dd_api_key_secret_arn
    "DD_EXTENSION_VERSION": "next"
    "DD_ENV" : var.env
    "DD_SERVICE" : var.service_name
    "DD_SITE" : var.dd_site
    "DD_VERSION" : var.app_version
    "ENV": var.env
    "POWERTOOLS_SERVICE_NAME": var.service_name
    "POWERTOOLS_LOG_LEVEL": "INFO" }),
    var.environment_variables
  )

  datadog_extension_layer_version = 90
  datadog_node_layer_version      = 127
}
```

### Deploy

To deploy, first create a file named `infra/dev.tfvars`. In your tfvars file, you need to add your the AWS Secrets Manager ARN for the secret containing your Datadog API Key.

```tf
dd_api_key_secret_arn="<DD_API_KEY_SECRET_ARN>"
dd_site="<YOUR PREFERRED DATADOG SITE>"
```

There's a single `main.tf` that contains all 7 backend services as modules. This is **not** recommended in production, and you should deploy backend services independenly. However, to simplify this demo deployment a single file is used.

The root of the repository contains a Makefile, this will transpile all Typescript code, generate the ZIP files and run `terraform apply`. To deploy the Terraform example, simply run:

You can optionally provide an S3 backend to use as your state store, to do this set the below environment variables and run `terraform init`

```sh
export AWS_REGION=<YOUR PREFERRED AWS_REGION>
export TF_STATE_BUCKET_NAME=<THE NAME OF THE S3 BUCKET>
export ENV=<ENVIRONMENT NAME>
make tf-node-local
```

Alternatively, comment out the S3 backend section in [`providers.tf'](./infra/providers.tf).

Alternatively, comment out the S3 backend section in [`providers.tf'](./infra/providers.tf).

```tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.61"
    }
  }
#  backend "s3" {}
}

provider "aws" {
  region = var.region
}
```

### Cleanup

To cleanup all Terraform resources run:

```sh
cd infra
terraform destroy --var-file dev.tfvars
```

## Serverless Framework

Datadog provides a [plugin](https://www.serverless.com/plugins/serverless-plugin-datadog) to simply configuration of your serverless applications when using the [serverless framework](https://www.serverless.com/). Inside your `serverless.yml` add a `custom.datadog` block. The available configuration options are available in the [documentation](https://www.serverless.com/plugins/serverless-plugin-datadog#configuration-parameters).

> **IMPORTANT** Ensure you add permissions to `secretsmanager:GetSecretValue` for the Secrets Manager secret holding your Datadog API key

```yaml
custom:
  datadog:
    apiKeySecretArn: ${param:DD_API_KEY_SECRET_ARN}
    site: ${param:DD_SITE}
    env: ${sls:stage}
    service: ${self:custom.serviceName}
    version: latest
    # Use this property with care in production to ensure PII/Sensitive data is not stored in Datadog
    captureLambdaPayload: true
    propagateUpstreamTrace: true
```

### Deploy

Ensure you have set the below environment variables before starting deployment:

- `DD_API_KEY_SECRET_ARN`: The Secrets Manager Secret ARN holding your Datadog API Key
- `DD_SITE`: The Datadog site to use
- `AWS_REGION`: The AWS region you want to deploy to

Once set, use the below commands to deploy each of the individual backend services on by one.

```sh
serverless deploy --stage dev --region=${AWS_REGION} --config serverless-shared.yml &&
serverless deploy --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-api.yml &&
serverless deploy --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-inventory-api.yml &&
serverless deploy --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-pricing-service.yml &&
serverless deploy --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-product-acl.yml &&
serverless deploy --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-api-worker.yml &&
serverless deploy --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-product-event-publisher.yml &&
serverless deploy --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-inventory-acl.yml &&
serverless deploy --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-inventory-ordering-service.yml &&
serverless deploy --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-analytics-service.yml
```

### Cleanup

The same commands can be used to cleanup all resources, but replacing `deploy` with `remove`.

```sh
serverless remove --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-analytics-service.yml &&
serverless remove --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-inventory-ordering-service.yml &&
serverless remove --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-inventory-acl.yml &&
serverless remove --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-product-event-publisher.yml &&
serverless remove --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-api-worker.yml &&
serverless remove --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-pricing-service.yml &&
serverless remove --param="DD_API_KEY_SECRET_ARN=${DD_API_KEY_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-api.yml &&
serverless remove --stage dev --region=${AWS_REGION} --config serverless-shared.yml
```

## Serverless Stack (SST)

This sample uses [sst v2](https://docs.sst.dev/what-is-sst) with `AWS CDK` to deploy the app.

**Note**: This is not using [Ion](https://sst.dev/), which is a complete rewrite of `sst`, using Pulumi and Terraform. 

The majority of the setup is common with [AWS CDK](#AWS-CDK), using the same stack definitions as the `AWS-CDK` sample. The Datadog configuration is done within the stack definitions for the purpose of this sample. This can be centralized in the `sst.config.ts` if you wish.

**Note**: `sst` provides a few useful L3 AWS CDK constructs that are not used much here, for brevity and convenience of using the same stacks as the `AWS-CDK` sample.

### Deploy

Ensure you have set the below environment variables before starting deployment:

- `DD_API_KEY_SECRET_ARN`: The Secrets Manager Secret ARN holding your Datadog API Key
- `DD_SITE`: The Datadog site to use
- `AWS_REGION`: The AWS region you want to deploy to

Once set, use the the sst `dev` command to run the stacks. This runs the functions locally, interacting with AWS services deployed remotely, e.g. API Gateway.  

`npm run dev:sst`

**Note**: Change the command in `package.json` to point to your personal stage, e.g. `james`. 

Use the API URL printed on your terminal by setting the environment variable `API_ENDPOINT` and run the below command to execute an integration test and populate the system with the full end to end flow. This will run the tests against your local Lambda functions.

```sh
npm run test -- product-service
```

Alternatively, you can deploy the entire stack to AWS, with the following command:

`npm run deploy:sst`


Post deployment, you can run the integration tests in the same way with the corresponding `API_ENDPOINT` value.

```sh
npm run test -- product-service
```

**Note**: You can't run these two apps "side by side" (unless you are deploying to a different account), as the name of the API (`NodeProductApiEndpoint`) is globally unique within an AWS account and therefore can be set as a stack output for two stacks. Delete your personal stack before you deploy the other stack.


### Cleanup

To remove a dev stack (your personal stack you ran locally), run `npm run remove:sst:personal`.

To remove a dev stack, run `npm run remove:sst`.

---

## Workshop Mode

This service ships in two distinct modes controlled by a single environment variable: `WORKSHOP_BUILD=true`. The variable is evaluated at both **build time** (which Lambda code gets bundled) and **CDK synthesis time** (which infrastructure gets created). CI/CD never sets it, so the working instrumented service is always the default.

### What changes between modes

| | CI/CD (default) | Workshop (`WORKSHOP_BUILD=true`) |
|---|---|---|
| Lambda code source | `src/pricing-api/adapters/` | `src/pricing-api/workshop/` |
| HTTP handler | Calls `PricingService`, returns pricing brackets | Returns hardcoded `"OK"` |
| SQS event handlers | Full processing with dd-trace spans | Acknowledge messages, do nothing |
| Datadog Lambda layer | Attached via CDK construct | Not attached |
| Datadog env vars | `DD_DATA_STREAMS_ENABLED`, trace propagation settings, etc. | Not set |
| `PricingEventHandlers` CDK construct | Deployed (SQS queues, EventBridge rules, Lambda functions) | Not deployed |

### Application layer

The working Lambda handler implementations live in `src/pricing-api/adapters/`. The workshop stubs live in `src/pricing-api/workshop/` and mirror the same file names:

| File | Working (`adapters/`) | Workshop stub (`workshop/`) |
|---|---|---|
| `calculatePricingFunction.ts` | Parses request, calls `PricingService`, returns tiered pricing | Returns `"OK"` — no logic, no instrumentation |
| `productCreatedPricingHandler.ts` | Processes events with dd-trace spans and semantic conventions | Acknowledges all messages silently |
| `productUpdatedPricingHandler.ts` | Same as above | Same stub pattern |

`package.sh` selects which directory to bundle based on `WORKSHOP_BUILD`:

```sh
# CI/CD — builds working instrumented handlers
make build

# Workshop — builds broken uninstrumented stubs
make workshop-build
```

### CDK infrastructure layer

The same `WORKSHOP_BUILD` variable controls what `pricingApiStack.ts` synthesises at CDK deploy time.

**Working (CI/CD) stack:**
- Creates a `DatadogLambda` construct and passes it to all Lambda functions via `SharedProps`
- Deploys the `PricingEventHandlers` construct, which creates the SQS queues, EventBridge subscription rules, and the two event handler Lambda functions
- Sets Datadog-specific env vars on each function (`DD_DATA_STREAMS_ENABLED`, `DD_TRACE_PROPAGATION_STYLE_EXTRACT`, etc.)

**Workshop stack:**
- `datadogConfiguration` is `undefined` — no Datadog Lambda layer or extension attached
- `PricingEventHandlers` is not instantiated — no SQS queues, no EventBridge rules, no event handler Lambdas
- Datadog env vars are not set on any function

```sh
# Deploy the working instrumented stack (CI/CD default)
make cdk-deploy

# Deploy the broken workshop stack
make workshop-cdk-deploy
```

The `workshop-cdk-deploy` target runs `workshop-build` first (to produce the stub ZIPs) and then synthesises and deploys the CDK stack with `WORKSHOP_BUILD=true`.

> [!NOTE]
> The working implementations in `adapters/` serve as the reference answer. Because both directories use the same file names, participants can compare them directly to understand what instrumentation was added.

---

## Observability

### Datadog Instrumentation

The working service uses [dd-trace](https://github.com/DataDog/dd-trace-js) for distributed tracing. The Datadog Lambda extension is attached at deploy time via the CDK construct, SAM macro, or Terraform module depending on which IaC tool is used.

### Semantic Conventions

Both SQS event handlers follow the [OpenTelemetry Semantic Conventions for Messaging Spans](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/). Each inbound message creates a dedicated processing span populated with the standard attributes:

- `messaging.system` — the messaging infrastructure (EventBridge via SQS)
- `messaging.operation.type` — `process`
- `messaging.message.type` — the CloudEvent type (e.g. `product.productCreated.v1`)
- `messaging.message.id`, `messaging.message.age`, `messaging.message.envelope.size`

See the shared helper in [`src/observability/observability.ts`](./src/observability/observability.ts).

### Span Links

When events cross service boundaries via EventBridge and SQS, the handlers extract the `traceparent` from the CloudEvent envelope and attach it as a [Span Link](https://docs.datadoghq.com/tracing/trace_collection/span_links/) rather than a parent-child relationship. This avoids creating a single trace that spans the entire system, while still preserving the causal relationship between the upstream publisher and this consumer.

### Issue Simulator

`PricingService` contains a built-in `issueSimulator` that produces observable failure scenarios useful for Datadog demonstrations:

| Price range | Behaviour |
|---|---|
| `90 – 95` | Throws an error — pricing cannot be calculated |
| `95 – 100` | Adds an 8-second delay — simulates slow processing |
| `50 – 60` | Adds a 40-second delay — exceeds the Lambda timeout |

These ranges are intentional. When the workshop service is uninstrumented, the failures are invisible. Once instrumented with Datadog, participants can observe the errors and latency spikes in traces and metrics — demonstrating the value of the instrumentation exercise.
