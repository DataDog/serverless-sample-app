package inventoryacl

import (
	sharedprops "cdk/shared"
	"os"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssecretsmanager"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"

	"github.com/DataDog/datadog-cdk-constructs-go/ddcdkconstruct"
)

type InventoryAclStackProps struct {
	awscdk.StackProps
}

func NewInventoryAclStack(scope constructs.Construct, id string, props *InventoryAclStackProps) awscdk.Stack {
	var sprops awscdk.StackProps
	if props != nil {
		sprops = props.StackProps
	}
	stack := awscdk.NewStack(scope, &id, &sprops)

	ddApiKeySecret := awssecretsmanager.Secret_FromSecretCompleteArn(stack, jsii.String("DDApiKeySecret"), jsii.String(os.Getenv("DD_SECRET_ARN")))

	serviceName := "GoInventoryAcl"
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

	eventBusParam := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("EventBusNameParam"), jsii.String("/go/shared/event-bus-name"))

	eventBus := awsevents.EventBus_FromEventBusName(stack, jsii.String("SharedEventBus"), eventBusParam.StringValue())

	NewInventoryAclService(stack, "InventoryAclService", &InventoryAclServiceProps{
		SharedProps: sharedprops.SharedProps{
			Env:         env,
			Version:     version,
			ServiceName: serviceName,
			Datadog:     datadog,
		},
		SharedEventBus: eventBus,
	})

	return stack
}
