# Java Implementation

This README contains relevant instructions for deploying the sample application with each of the available IaC tools. As well as details on any Java specific implementation details when instrumenting with Datadog.

The Java sample code uses [Spring Cloud Functions](https://spring.io/projects/spring-cloud-function) to enable SpringBoot features inside a serverless environment. Spring Cloud Functions could be substituted for [Micronaut](https://micronaut.io/) or [Quarkus](https://quarkus.io/) and the IaC code would stay the same.

## Testing

To generate load against your application, see the documentation on running a [load test](../../README.md#load-tests)

## AWS CDK

When using Java as your language of choice with the AWS CDK, you need to manually configure the Datadog Lambda Extension and the `dd-trace-java` layer. To simplify this configuration, a custom [`InstrumentFunction`](./cdk/src/main/java/com/cdk/constructs/InstrumentedFunction.java) construct is used to centralise all of the configuration.

```java
List<ILayerVersion> layers = new ArrayList<>(2);
layers.add(LayerVersion.fromLayerVersionArn(this, "DatadogJavaLayer", "arn:aws:lambda:eu-west-1:464622532012:layer:dd-trace-java:15"));
layers.add(LayerVersion.fromLayerVersionArn(this, "DatadogLambdaExtension", "arn:aws:lambda:eu-west-1:464622532012:layer:Datadog-Extension:64"));

var builder = Function.Builder.create(this, props.routingExpression())
    // Remove for brevity
    .layers(layers);
```

The relevant Datadog environment variables are also set.

```java
Map<String, String> lambdaEnvironment = new HashMap<>();
lambdaEnvironment.put("AWS_LAMBDA_EXEC_WRAPPER", "/opt/datadog_wrapper");
lambdaEnvironment.put("DD_SITE", System.getenv("DD_SITE") == null ? "datadoghq.com" : System.getenv("DD_SITE"));
lambdaEnvironment.put("DD_SERVICE", props.sharedProps().service());
lambdaEnvironment.put("DD_ENV", props.sharedProps().env());
lambdaEnvironment.put("DD_VERSION", props.sharedProps().version());
lambdaEnvironment.put("DD_API_KEY_SECRET_ARN", props.sharedProps().ddApiKeySecret().getSecretArn());
lambdaEnvironment.put("DD_CAPTURE_LAMBDA_PAYLOAD", "true");
lambdaEnvironment.put("DD_LOGS_INJECTION", "true");
```

The Datadog extension retrieves your Datadog API key from a Secrets Manager secret. For this to work, ensure you create a secret in your account containing your API key and set the `DD_SECRET_ARN` and `DD_SITE` environment variable before deployment. Eensure that you give your Lambda function permission to access the AWS Secrets Manager secret

```java
props.sharedProps().ddApiKeySecret().grantRead(this.function);
```

### Deploy

To simplify deployment, all of the different microservices are managed in the same CDK project. This **is not recommended** in real applications, but simplifies the deployment for demonstration purposes.

Each microservice is implemented as a seperate CloudFormation Stack, and there are no direct dependencies between stacks. Each stack stores relevant resource ARN's (SNS Topic ARN etc) in SSM Parameter Store, and the other stacks dynamically load the ARN's:

```java
String productCreatedArn = StringParameter.valueForStringParameter(this, "/java/product-api/product-created-topic");
ITopic productCreatedTopic = Topic.fromTopicArn(this, "ProductCreatedTopic", productCreatedArn);
```

You first need to compile your Java application code, before running `cdk deploy`. Run the below commands in order to deploy.

```sh
export DD_SECRET_ARN=<YOUR SECRET ARN>
export DD_SITE=<YOUR PREFERRED DATADOG SITE>
mvn clean package
cd cdk
cdk deploy --all --require-approval never
```

If you wish to deploy individual stacks, you can do that by running the respective command below:

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

The `CodeUri` property in the SAM template directly references a compiled `jar` file. Ensure you run `mvn clean package` before deploying a new version.

```sh
mvn clean package
sam build
sam deploy --stack-name JavaTracing --parameter-overrides ParameterKey=DDApiKeySecretArn,ParameterValue="$DD_SECRET_ARN" ParameterKey=DDSite,ParameterValue="$DD_SITE" --resolve-s3 --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --region $AWS_REGION
```

### Cleanup

Use the below `sh` script to cleanup resources deployed with AWS SAM.

```sh
sam delete --stack-name JavaInventoryOrderingService --region $AWS_REGION --no-prompts &&
sam delete --stack-name JavaInventoryAcl --region $AWS_REGION --no-prompts &&
sam delete --stack-name JavaProductApiWorkerStack --region $AWS_REGION --no-prompts &&
sam delete --stack-name JavaProductPublicEventPublisherStack --region $AWS_REGION --no-prompts &&
sam delete --stack-name JavaProductPricingServiceStack --region $AWS_REGION --no-prompts &&
sam delete --stack-name JavaProductApiStack --region $AWS_REGION --no-prompts &&
sam delete --stack-name JavaSharedStack --region $AWS_REGION --no-prompts
```

## Terraform

Terraform does not natively support compiling Java code. When deploying with Java, you first need to compile your Java code. The JAR file is passed directly to the `filename` property of the `aws_lambda_function` resource. The [`deploy.sh`](./deploy.sh) script performs this action. Running `mvn clean package` and then `terraform apply`.

### Configuration

A custom [`lambda_function`](./infra/modules/lambda-function/main.tf) module is used to group together all the functionality for deploying Lambda functions. This handles the creation of the CloudWatch Log Groups, and default IAM roles.

The [Datadog Lambda Terraform module](https://github.com/DataDog/terraform-aws-lambda-datadog) is used to create and configure the Lambda function with the required extensions, layers and configurations.

> **IMPORTANT!** If you are using AWS Secrets Manager to hold your Datadog API key, ensure your Lambda function has permissions to call the `secretsmanager:GetSecretValue` IAM action.

```terraform
module "aws_lambda_function" {
  source  = "DataDog/lambda-datadog/aws"
  version = "1.3.0"

  filename                 = var.jar_file
  function_name            = var.function_name
  role                     = aws_iam_role.lambda_function_role.arn
  handler                  = "org.springframework.cloud.function.adapter.aws.FunctionInvoker::handleRequest"
  runtime                  = "java21"
  memory_size              = var.memory_size
  logging_config_log_group = aws_cloudwatch_log_group.lambda_log_group.name
  source_code_hash         = base64sha256(filebase64(var.jar_file))
  timeout                  = var.timeout

  environment_variables = merge(tomap({
    "MAIN_CLASS" : "${var.package_name}.FunctionConfiguration"
    "DD_SITE" : var.dd_site
    "DD_SERVICE" : var.service_name
    "DD_ENV" : var.env
    "ENV" : var.env
    "DD_VERSION" : var.app_version
    "DD_API_KEY_SECRET_ARN" : var.dd_api_key_secret_arn
    "DD_CAPTURE_LAMBDA_PAYLOAD": "true"
    "DD_LOGS_INJECTION": "true"
    "spring_cloud_function_definition" : var.lambda_handler}),
    var.environment_variables
  )

  datadog_extension_layer_version = 64
  datadog_java_layer_version      = 15
}
```

### Deploy

To deploy, first create a file named `infra/dev.tfvars`. In your tfvars file, you need to add your the AWS Secrets Manager ARN for the secret containing your Datadog API Key.

```tf
dd_api_key_secret_arn="<DD_SECRET_ARN>"
dd_site="<YOUR PREFERRED DATADOG SITE>
```

There's a single `main.tf` that contains all 7 backend services as modules. This is **not** recommended in production, and you should deploy backend services independenly. However, to simplify this demo deployment a single file is used.

The root of the repository contains a `deploy.sh` file, this will compile all your Java code, generate the ZIP files and run `terraform apply`. To deploy the Terraform example, simply run:

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
    version: 64
    # Use this property with care in production to ensure PII/Sensitive data is not stored in Datadog
    captureLambdaPayload: true
    propagateUpstreamTrace: true
```

### Deploy

Ensure you have set the below environment variables before starting deployment:

- `DD_SECRET_ARN`: The Secrets Manager Secret ARN holding your Datadog API Key
- `DD_SITE`: The Datadog Site to use
- `AWS_REGION`: The AWS region you want to deploy to

Once set, use the below commands to deploy each of the individual backend services on by one. You will need to package your Java application before deploy.

```sh
mvn clean package &&
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