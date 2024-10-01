# NodeJS Implementation

This README contains relevant instructions for deploying the sample application with each of the available IaC tools. As well as details on any Node specific implementation details when instrumenting with Datadog. The current implementation of the Go tracer does not support automatic trace propagation through messaging services. The Go examples use SpanLinks as the primary method of linking systems together.

```go
span, context := tracer.StartSpanFromContext(ctx, "process.message", tracer.WithSpanLinks(spanLinks))
defer span.Finish()
```

## AWS CDK

The [Datadog CDK Construct](https://docs.datadoghq.com/serverless/libraries_integrations/cdk/) simplifies the setup when instrumenting with Datadog. To get started:

```sh
go get github.com/DataDog/datadog-cdk-constructs-go/ddcdkconstruct
```

Once installed, you can use the Construct to configure all of your Datadog settings. And then use the `AddLambdaFunctions` function to instrument your Lambda functions.

```go
datadog := ddcdkconstruct.NewDatadog(
		stack,
		jsii.String("Datadog"),
		&ddcdkconstruct.DatadogProps{
			ExtensionLayerVersion:  jsii.Number(65),
			AddLayers:              jsii.Bool(true),
			Site:                   jsii.String(os.Getenv("DD_SITE")),
			ApiKeySecret:           ddApiKeySecret,
			Service:                &serviceName,
			Env:                    &env,
			Version:                &version,
			EnableColdStartTracing: jsii.Bool(true),
			CaptureLambdaPayload:   jsii.Bool(true),
			EnableDatadogTracing:   jsii.Bool(true),
			EnableDatadogASM:       jsii.Bool(true),
		})

atadog.AddLambdaFunctions(&[]interface{}{function.Function}, nil)
```

This CDK implementation uses a [custom `InstrumentedFunction` L3 construct](./cdk/sharedConstructs/instrumentedFunction.go) to ensure all Lambda functions are instrumented correctly and consistently. This also removes the ability for the Lambda function to send logs to CloudWatch using a custom IAM policy. Logs are shipped using the Datadog extension, and aren't required to log to CloudWatch.

### Deploy

To simplify deployment, all of the different microservices are managed in the same CDK project. This **is not recommended** in real applications, but simplifies the deployment for demonstration purposes.

Each microservice is implemented as a seperate CloudFormation Stack, and there are no direct dependencies between stacks. Each stack stores relevant resource ARN's (SNS Topic ARN etc) in SSM Parameter Store, and the other stacks dynamically load the ARN's:

```go
productCreatedTopicParam := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("ProductCreatedTopicParam"), jsii.String("/go/product/product-created-topic"))

productCreatedTopic := awssns.Topic_FromTopicArn(stack, jsii.String("ProductCreatedTopic"), productCreatedTopicParam.StringValue())
```

The Datadog extension retrieves your Datadog API key from a Secrets Manager secret. For this to work, ensure you create a secret in your account containing your API key and set the `DD_SECRET_ARN` environment variable before deployment.

To deploy all stacks and resources, run:

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

Ensure you have set the below environment variables before starting deployment:

- `DD_SECRET_ARN`: The Secrets Manager Secret ARN holding your Datadog API Key
- `DD_SITE`: The Datadog Site to use
- `AWS_REGION`: The AWS region you want to deploy to

Once both environment variables are set, use the below `sh` script to deploy all backend services. You can deploy individual services as well if required. Due to the SSM parameters holding SNS Topic ARN's, the order of deployment is important.

The AWS SAM & Go Instrumentation works by manually adding the Datadog extension layer and setting the required environment variables:

```yaml
Globals:
  Function:
    Layers:
      - !Sub arn:aws:lambda:${AWS::Region}:464622532012:layer:Datadog-Extension-ARM:65
    Environment:
      Variables:
        DD_ENV: !Ref Env
        DD_API_KEY_SECRET_ARN: !Ref DDApiKeySecretArn
        DD_SITE: !Ref DDSite
        DD_VERSION: !Ref CommitHash
        DD_SERVICE: !Ref ServiceName
```

### Deploy

The `template.yaml` file contains an example of using a nested stack to deploy all 6 backend services in a single command. This **is not** recommended for production use cases, instead preferring independent deployments. For the purposes of this demonstration, a single template makes test deployments easier.

```sh
sam build
sam deploy --stack-name GoTracing --parameter-overrides ParameterKey=DDApiKeySecretArn,ParameterValue="$DD_SECRET_ARN" ParameterKey=DDSite,ParameterValue="$DD_SITE" --resolve-s3 --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --region $AWS_REGION
```

### Cleanup

Use the below `sh` script to cleanup resources deployed with AWS SAM.

```sh
sam delete --stack-name GoTracing --region $AWS_REGION --no-prompts
```

## Terraform

Terraform does not natively support compiling Go code. When deploying with Terraform, you first need to compile and ZIP up the Go code. The [`deploy.sh`](./deploy.sh) script performs this action.

### Configuration

A custom [`lambda_function`](./infra/modules/lambda-function/main.tf) module is used to group together all the functionality for deploying Lambda functions. This handles the creation of the CloudWatch Log Groups, and default IAM roles.

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
  runtime                  = "nodejs20.x"
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

  datadog_extension_layer_version = 62
  datadog_node_layer_version      = 112
}
```

### Deploy

To deploy, first create a file named `infra/dev.tfvars`. In your tfvars file, you need to add your the AWS Secrets Manager ARN for the secret containing your Datadog API Key.

```tf
dd_api_key_secret_arn="<DD_SECRET_ARN>"
dd_site="<YOUR PREFERRED DATADOG SITE>"
```

There's a single `main.tf` that contains all 7 backend services as modules. This is **not** recommended in production, and you should deploy backend services independenly. However, to simplify this demo deployment a single file is used.

The root of the repository contains a `deploy.sh` file, this will transpile all Typescript code, generate the ZIP files and run `terraform apply`. To deploy the Terraform example, simply run:

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

