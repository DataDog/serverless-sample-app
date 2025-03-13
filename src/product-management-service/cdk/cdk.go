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

	NewProductManagementService(app, "ProductManagementService", &ProductManagementServiceStackProps{
		StackProps: awscdk.StackProps{
			StackName: jsii.Sprintf("ProductManagementService-%s", localEnv),
		},
	})

	app.Synth(nil)
}

type ProductManagementServiceStackProps struct {
	awscdk.StackProps
}

func NewProductManagementService(scope constructs.Construct, id string, props *ProductManagementServiceStackProps) awscdk.Stack {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)

	serviceName := "ProductManagementService"
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
			ExtensionLayerVersion:  jsii.Number(73),
			AddLayers:              jsii.Bool(true),
			Site:                   jsii.String(os.Getenv("DD_SITE")),
			ApiKeySecret:           ddApiKeySecret,
			Service:                &serviceName,
			Env:                    &env,
			Version:                &version,
			EnableColdStartTracing: jsii.Bool(true),
			CaptureLambdaPayload:   jsii.Bool(true),
			EnableDatadogTracing:   jsii.Bool(true),
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
		ServiceProps:             serviceProps,
		ProductStockUpdatedTopic: productAcl.ProductStockUpdatedTopic,
		ProductTable:             productApi.Table,
	})

	services.NewProductPublicEventPublisherService(stack, "ProductPublicEventPublisher", &services.ProductPublicEventPublisherServiceProps{
		ServiceProps:        serviceProps,
		ProductCreatedTopic: productApi.ProductCreatedTopic,
		ProductUpdatedTopic: productApi.ProductUpdatedTopic,
		ProductDeletedTopic: productApi.ProductDeletedTopic,
	})

	return stack
}
