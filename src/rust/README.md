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

## Terraform

## Serverless Framework
