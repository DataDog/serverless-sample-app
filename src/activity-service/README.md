# Activity Service

**Runtime: Python**

**AWS Services Used: API Gatewat, Lambda, SQS, DynamoDB, EventBridge**

![Architecture Diagram](../../img/order-service-arch.png)

The activity service monitors events happening in other services and uses that to build a queryable list of all the activity for a given entity. It is made up of a single service, that handles both the event subscriptions and exposes the API endpoint.

> [!IMPORTANT]  
> The Datadog Lambda extension sends logs directly to Datadog without the need for CloudWatch. The examples in this repository disable Cloudwatch Logs for all Lambda functions.

## Deployment

Ensure you have set the below environment variables before starting deployment:

- `DD_API_KEY`: Your current DD_API_KEY
- `DD_SITE`: The Datadog Site to use
- `AWS_REGION`: The AWS region you want to deploy to
- `ENV`: The environment suffix you want to deploy to, this defaults to `dev`

## Observability for Asynchronous Systems

### Span Links

The default behavious of the Datadog tracer when working with serverless is to automatically create parent-child relationships. For example, if you consume a message from Amazon SNS and that message contains the `_datadog` trace context, the context is automatically extracted and your Lambda handler is set as a child of the upstream call.

This is useful in some cases, but can cause more confusion by creating traces that are extremely long, or have hundreds of spans underneath them. [Span Links](https://docs.datadoghq.com/tracing/trace_collection/span_links/) are an alternative approach that link together causally related spans, that you don't neccessarily want to include as a parent-child relationship. This can be useful when events are crossing service boundaries, or if you're processing a batch of messages.

To configure Span Links in Python, you can see an example in the [`create_activity.py` handler on line 339](./activity_service/handlers/create_activity.py#L339). The trace and span ID's are parsed from the inbound event, and then used to create a link to the upstream context.

For this to work, you must also set the below three environment variables on your Lambda function to disable automatic propagation.

```py
'DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT': 'ignore',
'DD_TRACE_PROPAGATION_STYLE_EXTRACT': "none",
# This flag disables automatic propagation of traces from incoming events.
'DD_BOTOCORE_DISTRIBUTED_TRACING': 'false',
```

### Semantic Conventions

The [Open Telemetry Semantic Conventions for Messaging Spans](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/) define a set of best practices that all spans related to messaging should follow.

You can see examples of this in [the handle events handler](./activity_service/handlers/create_activity.py#L103) for starting a span and [here for adding the default attributes](./activity_service/handlers/create_activity.py#L318).

## AWS CDK

The [Datadog CDK Construct](https://docs.datadoghq.com/serverless/libraries_integrations/cdk/) simplifies the setup when instrumenting with Datadog. To get started:

```sh
pip install datadog-cdk-constructs-v2
```

Once installed, you can use the Construct to configure all of your Datadog settings. And then use the `add_lambda_functions` function to instrument your Lambda functions.

```python
environment = os.environ.get("ENV", "dev")
version = os.environ.get("VERSION", "latest")
dd_api_key = os.environ.get("DD_API_KEY", "")
dd_site = os.environ.get("DD_SITE", "datadoghq.com")

self.datadog_configuration = DatadogLambda(self, "DatadogLambda",
    python_layer_version=109,
    extension_layer_version=81,
    service=SERVICE_NAME,
    env=environment,
    version=version,
    capture_lambda_payload=True,
    site=dd_site,
    api_key=dd_api_key,
)

shared_props.datadog_configuration.add_lambda_functions([self.event_handler_func, self.create_order_func])
```

### Deploy

The Datadog extension retrieves your Datadog API key from a Secrets Manager secret, this secret is created as part of the stack deployment.

If you are using secrets manager in production, you should create your secret separately from your application.

To deploy all stacks and resources, run:

```sh
cdk deploy --all --require-approval never
```

Alternatively, if you have `make` installed you can simply run:

`sh
make cdk-deploy
`

### Cleanup

To cleanup resources run

```sh
cdk destroy --all
```

Or if you're using `make`

```sh
make cdk-destroy
```

## AWS SAM

The AWS SAM example leverages the Datadog CloudFormation Macro. The macro auto-instruments your Lambda functions at the point of deployment. Ensure you have followed the [installation instructions](https://docs.datadoghq.com/serverless/libraries_integrations/macro/) before continuing with the SAM deployment.

```yaml
Transform:
  - AWS::Serverless-2016-10-31
  - Name: DatadogServerless
    Parameters:
      stackName: !Ref "AWS::StackName"
      apiKey: !Ref DDApiKey
      dotnetLayerVersion: "20"
      extensionLayerVersion: "83"
      service: !Ref ServiceName
      env: !Ref Env
      version: !Ref CommitHash
      site: !Ref DDSite
      captureLambdaPayload: true
```

### Deploy

```sh
sam build
sam deploy --stack-name OrdersService-${ENV} --parameter-overrides ParameterKey=DDApiKey,ParameterValue=${DD_API_KEY} ParameterKey=DDSite,ParameterValue=${DD_SITE} ParameterKey=Env,ParameterValue=${ENV} ParameterKey=CommitHash,ParameterValue=${COMMIT_HASH} --no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --resolve-s3 --region ${AWS_REGION}
```

Alternatively, you can run

```sh
make sam
```

### Cleanup

Use the below script to cleanup resources deployed with AWS SAM.

```sh
sam delete --stack-name DotnetTracing --region $AWS_REGION --no-prompts
```

## Terraform

//TODO: Add Terraform docs

### Deploy

The root of the repository contains a Makefile, this will compile all .NET code, generate the ZIP files and run `terraform apply`. To deploy the Terraform example, simply run:

```sh
export TF_STATE_BUCKET_NAME=<THE NAME OF THE S3 BUCKET>
make tf-apply
```

The `make tf-apply` command will compile and package your Lambda functions one by one, and then run `terraform apply --var-file dev.tfvars`.

The example expects an S3 backend to use as your state store. Alternatively, comment out the S3 backend section in [`providers.tf'](./infra/providers.tf).

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

And re-run the apply command.

```
make tf-apply-local
```

### Cleanup

To clean-up all Terraform resources run:

```sh
make tf-destroy
```
