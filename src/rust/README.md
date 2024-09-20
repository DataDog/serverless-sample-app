# Rust Implementation

The Rust implementation uses Open Telemetry for all of the tracing, which means trace propagation through SNS/SQS/EventBridge needs to be done manually. Both from a producer and a consumer perspective. All of the logic to propagate traces is held in a shared [`observability`](./src/observability/) crate. All of the logic is contained in the [`TracedMessage`](./src/observability/src/lib.rs) struct.

Messages are published using the `TracedMessage` struct as a wrapper, to ensure trace and span id's are consistently sent. The `From` trait is used at the consumer side to transform the Lambda Event struct `SnsEvent`, `SqsEvent` etc back into a `TracedMessage`.

```rust
let mut traced_message: TracedMessage = serde_json::from_str(value.sns.message.as_str()).unwrap();

let trace_id = TraceId::from_hex(traced_message.trace_id.as_str()).unwrap();
let span_id = SpanId::from_hex(traced_message.span_id.as_str()).unwrap();

let span_context = SpanContext::new(
    trace_id,
    span_id,
    TraceFlags::SAMPLED,
    false,
    TraceState::NONE,
);

let inflight_ctx = Context::new().with_remote_span_context(span_context.clone());
tracing::Span::current().set_parent(inflight_ctx.clone());
```

This README contains relevant instructions for deploying the sample application with each of the available IaC tools. As well as details on any Node specific implementation details when instrumenting with Datadog.

## AWS CDK

**There is no CDK for Rust. The CDK implementation uses `NodeJS` for the IaC, and Rust for the application code**

The [Datadog CDK Construct](https://docs.datadoghq.com/serverless/libraries_integrations/cdk/) simplifies the setup when instrumenting with Datadog. To get started:

```sh
npm i --save-dev datadog-cdk-constructs-v2
```

Once installed, you can use the Construct to configure all of your Datadog settings. And then use the `addLambdaFunctions` function to instrument your Lambda functions.

```typescript
const datadogConfiguration = new Datadog(this, "Datadog", {
  nodeLayerVersion: 115,
  extensionLayerVersion: 62,
  site: process.env.DD_SITE,
  apiKeySecret: ddApiKey,
  service,
  version,
  env,
  enableColdStartTracing: true,
  enableDatadogTracing: true,
  captureLambdaPayload: true,
});
```

This CDK implementation uses a [custom `InstrumentedFunction` L3 construct](./lib/constructs/lambdaFunction.ts) to ensure all Lambda functions are instrumented correctly and consistently. This uses the `RustFunction` construct from the `cargo-lambda-cdk` package.

### Deploy

To simplify deployment, all of the different microservices are managed in the same CDK project. This **is not recommended** in real applications, but simplifies the deployment for demonstration purposes.

Each microservice is implemented as a seperate CloudFormation Stack, and there are no direct dependencies between stacks. Each stack stores relevant resource ARN's (SNS Topic ARN etc) in SSM Parameter Store, and the other stacks dynamically load the ARN's:

```typescript
const productCreatedTopicArn = StringParameter.fromStringParameterName(
  this,
  "ProductCreatedTopicArn",
  "/node/product/product-created-topic"
);
const productCreatedTopic = Topic.fromTopicArn(
  this,
  "ProductCreatedTopic",
  productCreatedTopicArn.stringValue
);
```

The Datadog extension retrieves your Datadog API key from a Secrets Manager secret. For this to work, ensure you create a secret in your account containing your API key and set the `DD_SECRET_ARN` environment variable before deployment.

To deploy all stacks and resources, run:

```sh
export DD_SECRET_ARN=<YOUR SECRET ARN>
export DD_SITE=<YOUR PREFERRED DATADOG SITE>
cdk deploy --all --require-approval never
```

If you wish to deploy individual stacks, you can do that by running the respective command below:

```sh
cdk deploy RustSharedStack --require-approval never
cdk deploy RustProductApiStack --require-approval never
cdk deploy RustProductPublicEventPublisherStack --require-approval never
cdk deploy RustProductPricingServiceStack --require-approval never
```

### Cleanup

To cleanup resources run

```sh
cdk destroy --all
```

## AWS SAM

The AWS SAM manually addds the Datadog Lambda Extension and sets the required environment variables.

```yaml
Globals:
  Function:
    Runtime: provided.al2
    Timeout: 29
    MemorySize: 512
    Layers:
      - !Sub arn:aws:lambda:${AWS::Region}:464622532012:layer:Datadog-Extension:65
    Environment:
      Variables:
        ENV: !Ref Env
        DD_ENV: !Ref Env
        DD_API_KEY_SECRET_ARN: !Ref DDApiKeySecretArn
        DD_SITE: !Ref DDSite
        DD_VERSION: !Ref CommitHash
        DD_EXTENSION_VERSION: "next"
        DD_SERVICE: !Ref ServiceName
```

Ensure you have set the below environment variables before starting deployment:

- `DD_SECRET_ARN`: The Secrets Manager Secret ARN holding your Datadog API Key
- `DD_SITE`: The Datadog Site to use
- `AWS_REGION`: The AWS region you want to deploy to

### Deploy

The `template.yaml` file contains an example of using a nested stack to deploy all 6 backend services in a single command. This **is not** recommended for production use cases, instead preferring independent deployments. For the purposes of this demonstration, a single template makes test deployments easier.

```sh
sam build
sam deploy --stack-name RustTracing --parameter-overrides ParameterKey=DDApiKeySecretArn,ParameterValue="$DD_SECRET_ARN" ParameterKey=DDSite,ParameterValue="$DD_SITE" --resolve-s3 --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --region $AWS_REGION
```

### Cleanup

Use the below `sh` script to cleanup resources deployed with AWS SAM.

```sh
sam delete --stack-name RustTracing --region $AWS_REGION
```

## Terraform

Terraform does not natively support compiling Rust. Before you deploy you first need to compile and ZIP up the compiled code. The [`deploy.sh`](./deploy.sh) script performs this action. Iterating over all of the `Cargo.toml` files and running `cargo lambda build` before zipping up all folders in the output folder.

### Configuration

A custom [`lambda_function`](./infra/modules/lambda-function/main.tf) module is used to group together all the functionality for deploying Lambda functions. This handles the creation of the CloudWatch Log Groups, and default IAM roles.

The Datadog Lambda Terraform module is used to create and configure the Lambda function with the required extensions, layers and configurations.

> **IMPORTANT!** If you are using AWS Secrets Manager to hold your Datadog API key, ensure your Lambda function has permissions to call the `secretsmanager:GetSecretValue` IAM action.

```terraform
module "aws_lambda_function" {
  source  = "DataDog/lambda-datadog/aws"
  version = "1.4.0"

  filename                 = var.zip_file
  function_name            = var.function_name
  role                     = aws_iam_role.lambda_function_role.arn
  handler                  = var.lambda_handler
  runtime                  = "provided.al2023"
  memory_size              = 128
  logging_config_log_group = aws_cloudwatch_log_group.lambda_log_group.name
  source_code_hash = "${filebase64sha256(var.zip_file)}"
  timeout = 29
  environment_variables = merge(tomap({
    "DD_API_KEY_SECRET_ARN" : var.dd_api_key_secret_arn
    "DD_EXTENSION_VERSION": "next"
    "DD_CAPTURE_LAMBDA_PAYLOAD": "true",
    "DD_ENV" : var.env
    "DD_SERVICE" : var.service_name
    "DD_SITE" : var.dd_site
    "DD_VERSION" : var.app_version
    "ENV": var.env
    "RUST_LOG": "info",
    "POWERTOOLS_SERVICE_NAME": var.service_name
    "POWERTOOLS_LOG_LEVEL": "INFO" }),
    var.environment_variables
  )

  datadog_extension_layer_version = 65
}
```

### Deploy

To deploy, first create a file named `infra/dev.tfvars`. In your tfvars file, you need to add your the AWS Secrets Manager ARN for the secret containing your Datadog API Key.

```tf
dd_api_key_secret_arn="<DD_SECRET_ARN>"
dd_site="<YOUR PREFERRED DATADOG SITE>"
```

There's a single `main.tf` that contains all 7 backend services as modules. This is **not** recommended in production, and you should deploy backend services independenly. However, to simplify this demo deployment a single file is used.

The root of the repository contains a `deploy.sh` file, this will transpile all Rust code, generate the ZIP files and run `terraform apply`. To deploy the Terraform example, simply run:

```sh
./deploy.sh
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
    apiKeySecretArn: ${param:DD_SECRET_ARN}
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

- `DD_SECRET_ARN`: The Secrets Manager Secret ARN holding your Datadog API Key
- `DD_SITE`: The Datadog site to use
- `AWS_REGION`: The AWS region you want to deploy to

Once set, use the below commands to deploy each of the individual backend services on by one.

```sh
serverless deploy --stage dev --region=${AWS_REGION} --config serverless-shared.yml &&
serverless deploy --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-api.yml &&
serverless deploy --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-pricing-service.yml &&
serverless deploy --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-api-worker.yml &&
serverless deploy --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-product-event-publisher.yml &&
serverless deploy --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-inventory-acl.yml &&
serverless deploy --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-inventory-ordering-service.yml &&
serverless deploy --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-analytics-service.yml
```

### Cleanup

The same commands can be used to cleanup all resources, but replacing `deploy` with `remove`.

```sh
serverless remove --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-analytics-service.yml &&
serverless remove --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-inventory-ordering-service.yml &&
serverless remove --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-inventory-acl.yml &&
serverless remove --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-product-event-publisher.yml &&
serverless remove --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-api-worker.yml &&
serverless remove --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-pricing-service.yml &&
serverless remove --param="DD_SECRET_ARN=${DD_SECRET_ARN}" --param="DD_SITE=${DD_SITE}" --stage dev --region=${AWS_REGION} --config serverless-api.yml &&
serverless remove --stage dev --region=${AWS_REGION} --config serverless-shared.yml
```
