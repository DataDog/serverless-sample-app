package main

import (
	services "cdk/services"
	sharedconstructs "cdk/sharedConstructs"
	"fmt"
	"os"

	"github.com/DataDog/datadog-cdk-constructs-go/ddcdkconstruct"
	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssecretsmanager"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

func main() {
	defer jsii.Close()

	app := awscdk.NewApp(nil)
	localEnv := os.Getenv("ENV")
	if len(localEnv) <= 0 {
		localEnv = "dev"
	}

	stack := NewProductService(app, "ProductService", &ProductServiceStackProps{
		StackProps: awscdk.StackProps{
			StackName: jsii.Sprintf("ProductService-%s", localEnv),
		},
	})

	awscdk.Tags_Of(stack).Add(jsii.String("env"), &localEnv, &awscdk.TagProps{})
	awscdk.Tags_Of(stack).Add(jsii.String("project"), jsii.String("serverless-sample-app"), &awscdk.TagProps{})
	awscdk.Tags_Of(stack).Add(jsii.String("service"), jsii.String("product-service"), &awscdk.TagProps{})
	awscdk.Tags_Of(stack).Add(jsii.String("team"), jsii.String("advocacy"), &awscdk.TagProps{})
	awscdk.Tags_Of(stack).Add(jsii.String("primary-owner"), jsii.String("james@datadog.com"), &awscdk.TagProps{})

	app.Synth(nil)
}

type ProductServiceStackProps struct {
	awscdk.StackProps
}

func NewProductService(scope constructs.Construct, id string, props *ProductServiceStackProps) awscdk.Stack {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)

	serviceName := "ProductService"
	env := os.Getenv("ENV")
	if len(env) <= 0 {
		env = "dev"
	}
	version := os.Getenv("VERSION")
	if len(version) <= 0 {
		version = "latest"
	}

	ddApiKey := os.Getenv("DD_API_KEY")
	secretValue := awscdk.SecretValue_UnsafePlainText(&ddApiKey)

	ddApiKeySecret := awssecretsmanager.NewSecret(stack, jsii.String("Secret"), &awssecretsmanager.SecretProps{
		SecretStringValue: secretValue,
		SecretName:        jsii.String(fmt.Sprintf("/%s/%s/datadog-api-key", env, serviceName)),
	})

	datadog := ddcdkconstruct.NewDatadog(
		stack,
		jsii.String("Datadog"),
		&ddcdkconstruct.DatadogProps{
			ExtensionLayerVersion:  jsii.Number(90),
			AddLayers:              jsii.Bool(true),
			Site:                   jsii.String(os.Getenv("DD_SITE")),
			ApiKeySecret:           ddApiKeySecret,
			Service:                &serviceName,
			Env:                    &env,
			Version:                &version,
			EnableColdStartTracing: jsii.Bool(true),
			CaptureLambdaPayload:   jsii.Bool(true),
			EnableDatadogTracing:   jsii.Bool(true),
			FlushMetricsToLogs:     jsii.Bool(true),
			EnableMergeXrayTraces:  jsii.Bool(true),
		})

	sharedProps := sharedconstructs.SharedProps{
		Env:         env,
		Version:     version,
		ServiceName: serviceName,
		Datadog:     datadog,
	}

	serviceProps := services.NewProductServiceProps(stack, sharedProps)

	productApi := services.NewProductApi(stack, "ProductApi", &services.ProductApiProps{
		ServiceProps: serviceProps,
	})

	productAcl := services.NewProductAclService(stack, "ProductAclService", &services.ProductAclServiceProps{
		ServiceProps: serviceProps,
	})

	services.NewProductBackgroundServices(stack, "ProductBackgroundServices", &services.ProductBackgroundServiceProps{
		ServiceProps:                serviceProps,
		ProductStockUpdatedTopic:    productAcl.ProductStockUpdatedTopic,
		PriceCalculatedTopic:        productAcl.PriceCalculatedTopic,
		DatabaseClusterEndpoint:     productApi.DatabaseClusterEndpoint,
		DatabaseClusterAccessPolicy: productApi.DatabaseClusterAccessPolicy,
	})

	services.NewProductPublicEventPublisherService(stack, "ProductPublicEventPublisher", &services.ProductPublicEventPublisherServiceProps{
		ServiceProps:        serviceProps,
		ProductCreatedTopic: productApi.ProductCreatedTopic,
		ProductUpdatedTopic: productApi.ProductUpdatedTopic,
		ProductDeletedTopic: productApi.ProductDeletedTopic,
	})

	return stack
}
