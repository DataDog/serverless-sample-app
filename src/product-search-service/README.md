# Product Search Service

**Runtime: Python**

**AWS Services Used: API Gateway, Lambda, SQS, DynamoDB, EventBridge, S3 Vectors, Amazon Bedrock**

The product search service provides AI-powered natural language search over the product catalog. It listens to product, pricing, and inventory events from the shared EventBridge bus, embeds each product into a vector store using Amazon Bedrock, and exposes an HTTP API that accepts a natural language query and returns semantically matching products alongside an AI-generated answer.

> [!IMPORTANT]
> The Datadog Lambda extension sends logs directly to Datadog without the need for CloudWatch. The examples in this repository disable CloudWatch Logs for all Lambda functions.

## Architecture

Two Lambda functions make up the service:

- **CatalogSyncFunction** — consumes events from an SQS queue (fed by EventBridge rules on the shared bus), fetches full product details from the Product Management Service, generates a vector embedding via Bedrock, and upserts the result into an S3 Vectors index.
- **ProductSearchFunction** — accepts a `POST /search` request, embeds the query, queries S3 Vectors for the nearest neighbours, enriches the results from DynamoDB, and uses a Bedrock generative model to produce a natural language answer.

## Deployment

Ensure you have set the below environment variables before starting deployment:

- `DD_API_KEY`: Your current DD_API_KEY
- `DD_SITE`: The Datadog site to use
- `AWS_REGION`: The AWS region you want to deploy to
- `ENV`: The environment suffix you want to deploy to, defaults to `dev`

## Observability

### LLM Observability

The service is instrumented with [Datadog LLM Observability](https://docs.datadoghq.com/llm_observability/) to trace every Bedrock call — both embedding generation and answer synthesis. This lets you monitor latency, token usage, and model inputs/outputs across the full search pipeline.

LLM Observability is enabled by setting the following environment variables on both Lambda functions:

```python
"DD_LLMOBS_ENABLED": "1",
"DD_LLMOBS_ML_APP": "product-search-service",
```

### Span Links

When consuming messages from SQS (which originally arrived via EventBridge), the default Datadog tracer behaviour would create a parent-child relationship between the upstream publisher and the Lambda handler. For cross-service event pipelines this produces very long traces. [Span Links](https://docs.datadoghq.com/tracing/trace_collection/span_links/) are used instead to causally connect spans without nesting them.

The following environment variables disable automatic context extraction so that Span Links can be managed explicitly:

```python
"DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT": "ignore",
"DD_TRACE_PROPAGATION_STYLE_EXTRACT": "none",
"DD_BOTOCORE_DISTRIBUTED_TRACING": "false",
```

### Data Streams Monitoring

[Datadog Data Streams Monitoring](https://docs.datadoghq.com/data_streams/) is enabled to track end-to-end latency through the EventBridge → SQS → Lambda pipeline:

```python
"DD_DATA_STREAMS_ENABLED": "true",
```

## AWS CDK

The [Datadog CDK Construct](https://docs.datadoghq.com/serverless/libraries_integrations/cdk/) simplifies setup when instrumenting with Datadog. To get started:

```sh
pip install datadog-cdk-constructs-v2
```

Once installed, use the construct to configure all Datadog settings, then call `add_lambda_functions` to instrument your Lambda functions:

```python
environment = os.environ.get("ENV", "dev")
version = os.environ.get("VERSION", "latest")
dd_api_key = os.environ.get("DD_API_KEY", "")
dd_site = os.environ.get("DD_SITE", "datadoghq.com")

datadog = DatadogLambda(
    self,
    "DatadogLambda",
    python_layer_version=123,
    extension_layer_version=93,
    service=SERVICE_NAME,
    env=environment,
    version=version,
    capture_lambda_payload=True,
    site=dd_site,
    api_key=dd_api_key,
)

datadog.add_lambda_functions([catalog_sync_fn, product_search_fn])
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

The AWS SAM example uses the [Datadog CloudFormation Macro](https://docs.datadoghq.com/serverless/libraries_integrations/macro/) to auto-instrument Lambda functions at deploy time. Ensure you have followed the installation instructions before continuing.

```yaml
Transform:
  - AWS::Serverless-2016-10-31
  - Name: DatadogServerless
    Parameters:
      stackName: !Ref "AWS::StackName"
      apiKey: !Ref DDApiKey
      pythonLayerVersion: 123
      extensionLayerVersion: "93"
      service: !Ref DDServiceName
      env: !Ref Env
      version: !Ref CommitHash
      site: !Ref DDSite
      captureLambdaPayload: true
```

### Deploy

```sh
make sam
```

### Cleanup

```sh
make sam-destroy
```

## Terraform

The Terraform configuration is located in the [`infra`](./infra) directory. It uses an S3 backend for remote state.

### Deploy

```sh
export TF_STATE_BUCKET_NAME=<THE NAME OF THE S3 BUCKET>
make tf-apply
```

To deploy without a remote S3 backend, comment out the `backend "s3" {}` block in [`infra/providers.tf`](./infra/providers.tf) and run:

```sh
make tf-apply-local
```

### Cleanup

```sh
make tf-destroy
```
