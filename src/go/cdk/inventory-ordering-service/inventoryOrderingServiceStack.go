package inventoryorderingservice

import (
	sharedprops "cdk/shared"
	"os"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssecretsmanager"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"

	"github.com/DataDog/datadog-cdk-constructs-go/ddcdkconstruct"
)

type InventoryOrderingServiceStackProps struct {
	awscdk.StackProps
}

func NewInventoryOrderingServiceStack(scope constructs.Construct, id string, props *InventoryOrderingServiceStackProps) awscdk.Stack {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)

	ddApiKeySecret := awssecretsmanager.Secret_FromSecretCompleteArn(stack, jsii.String("DDApiKeySecret"), jsii.String(os.Getenv("DD_SECRET_ARN")))

	serviceName := "GoInventoryOrderingService"
	env := os.Getenv("ENV")
	if len(env) <= 0 {
		env = "dev"
	}
	version := os.Getenv("VERSION")
	if len(version) <= 0 {
		version = "latest"
	}

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

	inventoryProductAddedTopicParam := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("ProductCreatedTopicParam"), jsii.String("/go/inventory/product-added-topic"))

	inventoryProductAddedTopic := awssns.Topic_FromTopicArn(stack, jsii.String("InventoryProductAddedTopic"), inventoryProductAddedTopicParam.StringValue())

	NewInventoryOrderingService(stack, "InventoryOrderingService", &InventoryOrderingServiceProps{
		SharedProps: sharedprops.SharedProps{
			Env:         env,
			Version:     version,
			ServiceName: serviceName,
			Datadog:     datadog,
		},
		ProductAddedTopic: inventoryProductAddedTopic,
	})

	return stack
}
