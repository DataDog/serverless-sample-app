# .NET Implementation

This README contains relevant instructions for deploying the sample application with each of the available IaC tools. As well as details on any .NET specific implementation details when instrumenting with Datadog.

The .NET sample code uses the [Lambda Annotations Framework](https://github.com/aws/aws-lambda-dotnet/blob/master/Libraries/src/Amazon.Lambda.Annotations/README.md) to simplify how you define Lambda functions.

## Testing

To generate load against your application, see the documentation on running a [load test](../../README.md#load-tests)

## AWS CDK

When using .NET as your language of choice with the AWS CDK, you can use the `Amazon.CDK.AWS.Lambda.DotNet` Nuget package to compile your Lambda Functions. This Nuget package provides a `DotNetFunction` class that handles the compilation of your .NET code.

You also need to ensure you manually add the Datadog Lambda layers, one for the .NET tracer and one for the Datadog Lambda Extension.

```c#
Layers =
[
    LayerVersion.FromLayerVersionArn(this, "DDExtension", "arn:aws:lambda:eu-west-1:464622532012:layer:Datadog-Extension-ARM:64"),
    LayerVersion.FromLayerVersionArn(this, "DDTrace", "arn:aws:lambda:eu-west-1:464622532012:layer:dd-trace-dotnet-ARM:15"),
],
```

The relevant Datadog environment variables are also set.

```c#
var defaultEnvironmentVariables = new Dictionary<string, string>()
{
    { "POWERTOOLS_SERVICE_NAME", props.Shared.ServiceName },
    { "POWERTOOLS_LOG_LEVEL", "DEBUG" },
    { "AWS_LAMBDA_EXEC_WRAPPER", "/opt/datadog_wrapper" },
    { "DD_SITE", System.Environment.GetEnvironmentVariable("DD_SITE") },
    { "DD_ENV", props.Shared.Env },
    { "ENV", props.Shared.Env },
    { "DD_VERSION", props.Shared.Version },
    { "DD_SERVICE", props.Shared.ServiceName },
    { "DD_API_KEY_SECRET_ARN", props.DdApiKeySecret.SecretArn },
    { "DD_CAPTURE_LAMBDA_PAYLOAD", "true" },
};
```

The Datadog extension retrieves your Datadog API key from a Secrets Manager secret. For this to work, ensure you create a secret in your account containing your API key and set the `DD_SECRET_ARN` and `DD_SITE` environment variable before deployment. Eensure that you give your Lambda function permission to access the AWS Secrets Manager secret

```c#
props.DdApiKeySecret.GrantRead(Function);
```

### Deploy

To simplify deployment, all of the different microservices are managed in the same CDK project. This **is not recommended** in real applications, but simplifies the deployment for demonstration purposes.

Each microservice is implemented as a seperate CloudFormation Stack, and there are no direct dependencies between stacks. Each stack stores relevant resource ARN's (SNS Topic ARN etc) in SSM Parameter Store, and the other stacks dynamically load the ARN's:

```c#
var pricingUpdatedTopicParameter = StringParameter.FromStringParameterName(this, "PricingUpdatedTopicArn", "/dotnet/product-pricing/pricing-updated-topic");
var pricingUpdatedTopic = Topic.FromTopicArn(this, "PricingUpdatedTopic", pricingUpdatedTopicParameter.StringValue);
```

Run the below commands in order to deploy.

```sh
export DD_SECRET_ARN=<YOUR SECRET ARN>
export DD_SITE=<YOUR PREFERRED DATADOG SITE>
cd cdk
cdk deploy --all --require-approval never
```

### Cleanup

To cleanup resources run

```sh
cdk destroy --all
```

## AWS SAM

The AWS SAM example leverages the Datadog CloudFormation Macro. The macro auto-instruments your Lambda functions at the point of deployment. Ensure you have followed the [installation instructions](https://docs.datadoghq.com/serverless/libraries_integrations/macro/) before continuing with the SAM deployment.

Ensure you have set the below environment variables before starting deployment:

- `DD_SECRET_ARN`: The Secrets Manager Secret ARN holding your Datadog API Key
- `DD_SITE`: The Datadog Site to use
- `AWS_REGION`: The AWS region you want to deploy to

Once both environment variables are set, use the below `sh` script to deploy all backend services. You can deploy individual services as well if required. Due to the SSM parameters holding SNS Topic ARN's, the order of deployment is important.

### Deploy

The `template.yaml` file contains an example of using a nested stack to deploy all 6 backend services in a single command. This **is not** recommended for production use cases, instead preferring independent deployments. For the purposes of this demonstration, a single template makes test deployments easier.

```sh
sam build
sam deploy --stack-name DotnetTracing --parameter-overrides "ParameterKey=DDApiKeySecretArn,ParameterValue=$DD_SECRET_ARN" "ParameterKey=DDSite,ParameterValue=$DD_SITE" --resolve-s3 --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --region $AWS_REGION
```

### Cleanup

Use the below `sh` script to cleanup resources deployed with AWS SAM.

```sh
sam delete --stack-name DotnetTracing --region $AWS_REGION --no-prompts
```

## Terraform

Terraform does not natively support compiling .NET code. When deploying with Terraform, you first need to compile your .NET code. The publish directory is passed to the Lambda function resource as a .ZIP file. A [`make`](https://formulae.brew.sh/formula/make) command is used to test, package and deploy .NET code with terraform.

From the repository root, run:

```sh
make tf-dotnet
```

### Configuration

A custom [`lambda_function`](./infra/modules/lambda-function/main.tf) module is used to group together all the functionality for deploying Lambda functions. This handles the creation of the CloudWatch Log Groups, and default IAM roles.

The [Datadog Lambda Terraform module](https://github.com/DataDog/terraform-aws-lambda-datadog) is used to create and configure the Lambda function with the required extensions, layers and configurations.

> **IMPORTANT!** If you are using AWS Secrets Manager to hold your Datadog API key, ensure your Lambda function has permissions to call the `secretsmanager:GetSecretValue` IAM action.

```terraform
module "aws_lambda_function" {
  source  = "DataDog/lambda-datadog/aws"
  version = "1.4.0"

  filename                 = var.publish_directory
  function_name            = "Dotnet-${var.function_name}-${var.env}"
  role                     = aws_iam_role.lambda_function_role.arn
  handler                  = var.lambda_handler
  runtime                  = "dotnet8"
  memory_size              = var.memory_size
  logging_config_log_group = aws_cloudwatch_log_group.lambda_log_group.name
  source_code_hash         = base64sha256(filebase64(var.publish_directory))
  timeout                  = var.timeout

  environment_variables = merge(tomap({
    "DD_SITE" : var.dd_site
    "DD_SERVICE" : var.service_name
    "DD_ENV" : var.env
    "ENV" : var.env
    "DD_VERSION" : var.app_version
    "DD_API_KEY_SECRET_ARN" : var.dd_api_key_secret_arn
    "DD_CAPTURE_LAMBDA_PAYLOAD": "true"
    "DD_LOGS_INJECTION": "true"}),
    var.environment_variables
  )

  datadog_extension_layer_version = 64
  datadog_dotnet_layer_version      = 15
}
```

### Deploy

To deploy, first create a file named `infra/dev.tfvars`. In your tfvars file, you need to add your the AWS Secrets Manager ARN for the secret containing your Datadog API Key.

```tf
dd_api_key_secret_arn="<DD_SECRET_ARN>"
dd_site="<YOUR PREFERRED DATADOG SITE>
```

There's a single `main.tf` that contains all 7 backend services as modules. This is **not** recommended in production, and you should deploy backend services independenly. However, to simplify this demo deployment a single file is used.

### Cleanup

To cleanup all Terraform resources run:

```sh
make tf-dotnet-destroy
```

## Serverless Framework

The Serverless Framework has not added support for .NET 8 in serverless framework V3. Due to the changes in licensing for the serverless framework in V4 onwards, this repo **does not** include examples for V4, and therefore does not include examples for .NET 8 and serverless framework.

See this [GitHub issue for further comments](https://github.com/serverless/serverless/issues/12367).