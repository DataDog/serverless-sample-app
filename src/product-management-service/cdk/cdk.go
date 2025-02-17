package main

import (
	services "cdk/services"
	sharedconstructs "cdk/sharedConstructs"
	"os"

	"github.com/DataDog/datadog-cdk-constructs-go/ddcdkconstruct"
	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssecretsmanager"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
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

	ddApiKeySecret := awssecretsmanager.Secret_FromSecretCompleteArn(stack, jsii.String("DDApiKeySecret"), jsii.String(os.Getenv("DD_API_KEY_SECRET_ARN")))

	datadog := ddcdkconstruct.NewDatadog(
		stack,
		jsii.String("Datadog"),
		&ddcdkconstruct.DatadogProps{
			ExtensionLayerVersion:  jsii.Number(68),
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

	jwtSecretKeyParam := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("JwtSecretKeyParameter"), jsii.Sprintf("/%s/shared/secret-access-key", env))
	eventBusParam := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("EventBusNameParam"), jsii.Sprintf("/%s/shared/event-bus-name", env))

	eventBus := awsevents.EventBus_FromEventBusName(stack, jsii.String("SharedEventBus"), eventBusParam.StringValue())

	sharedProps := sharedconstructs.SharedProps{
		Env:         env,
		Version:     version,
		ServiceName: serviceName,
		Datadog:     datadog,
	}

	productApi := services.NewProductApi(stack, "ProductApi", &services.ProductApiProps{
		SharedProps:                 sharedProps,
		JwtSecretAccessKeyParameter: jwtSecretKeyParam,
	})

	productAcl := services.NewProductAclService(stack, "ProductAclService", &services.ProductAclServiceProps{
		SharedProps:    sharedProps,
		SharedEventBus: eventBus,
	})

	services.NewProductBackgroundServices(stack, "ProductBackgroundServices", &services.ProductBackgroundServiceProps{
		SharedProps:              sharedProps,
		ProductStockUpdatedTopic: productAcl.ProductStockUpdatedTopic,
		ProductTable:             productApi.Table,
	})

	services.NewProductPublicEventPublisherService(stack, "ProductPublicEventPublisher", &services.ProductPublicEventPublisherServiceProps{
		SharedProps:         sharedProps,
		ProductCreatedTopic: productApi.ProductCreatedTopic,
		ProductUpdatedTopic: productApi.ProductUpdatedTopic,
		ProductDeletedTopic: productApi.ProductDeletedTopic,
		SharedEventBus:      eventBus,
	})

	return stack
}
