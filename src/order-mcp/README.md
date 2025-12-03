# Loyalty Point Service

**Runtime: NodeJS**

**AWS Services Used: API Gateway, Lambda, SQS, DynamoDB, EventBridge**

The loyalty account service tracks the status of a users loyalty account, and manages how many loyalty points a user has. It allows users to retrieve the current state of their loyalty account, and reacts to OrderCompleted events to add additional points to a loyalty account.

1. The `Api` provides various endpoints to get a users loyalty account, as well as an additional endpoint to spend their points
2. The `LoyaltyACL` service is an [anti-corruption layer](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer) that consumes events published by external services, translates them to internal events and processes them

## Testing

The repo includes an integration test that hits all 4 of the CRUD API endpoints. If you have deployed all of the backend services, running this test will give you the full set of end to end traces. The integration test dynamically loads the API endpoint from an SSM parameter named `/node/product/api-endpoint`. If you need to override the API endpoint you are testing against, set the environment variable named `API_ENDPOINT`.

```sh
npm run test -- product-service
```

## AWS CDK

The [Datadog CDK Construct](https://docs.datadoghq.com/serverless/libraries_integrations/cdk/) simplifies the setup when instrumenting with Datadog. To get started:

```sh
npm i --save-dev datadog-cdk-constructs-v2
```

Once installed, you can use the Construct to configure all of your Datadog settings. And then use the `addLambdaFunctions` function to instrument your Lambda functions.

```typescript
const datadogConfiguration = new Datadog(this, "Datadog", {
  nodeLayerVersion: 130,
  extensionLayerVersion: '90',
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

This CDK implementation uses a [custom `InstrumentedFunction` L3 construct](./lib/constructs/lambdaFunction.ts) to ensure all Lambda functions are instrumented correctly and consistently.

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

The Datadog extension retrieves your Datadog API key from a Secrets Manager secret. For this to work, ensure you create a secret in your account containing your API key and set the `DD_API_KEY_SECRET_ARN` environment variable before deployment.

To deploy all stacks and resources, run:

```sh
export DD_API_KEY_SECRET_ARN=<YOUR SECRET ARN>
export DD_SITE=<YOUR PREFERRED DATADOG SITE>
cdk deploy --all --require-approval never
```

If you wish to deploy individual stacks, you can do that by running the respective command below:

```sh
cdk deploy NodeSharedStack --require-approval never
cdk deploy NodeProductApiStack --require-approval never
cdk deploy NodeProductPublicEventPublisherStack --require-approval never
cdk deploy NodeProductPricingServiceStack --require-approval never
```

Post deployment, run the below command to execute an integration test and populate the system with the full end to end flow.

```sh
npm run test -- product-service
```

### Cleanup

To cleanup resources run

```sh
cdk destroy --all
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
