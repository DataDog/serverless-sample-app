package services

import (
	"cdk/sharedConstructs"
	"fmt"
	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/jsii-runtime-go"
)

type ProductServiceProps struct {
	SharedProps             sharedconstructs.SharedProps
	ProductEventBus         awsevents.IEventBus
	SharedEventBus          awsevents.IEventBus
	JwtSecretAccessKeyParam awsssm.IStringParameter
}

func (p *ProductServiceProps) getPublisherEventBus() awsevents.IEventBus {
	if p.SharedEventBus != nil {
		return p.SharedEventBus
	} else {
		return p.ProductEventBus
	}
}

func NewProductServiceProps(stack awscdk.Stack, sharedProps sharedconstructs.SharedProps) ProductServiceProps {

	productServiceEventBus := awsevents.NewEventBus(stack, jsii.String("ProductService"), &awsevents.EventBusProps{
		EventBusName: jsii.String(fmt.Sprintf("%s-bus-%s", sharedProps.ServiceName, sharedProps.Env)),
	})

	awsssm.NewStringParameter(stack, jsii.String("ProductEventBusName"), &awsssm.StringParameterProps{
		ParameterName: jsii.Sprintf("/%s/%s/event-bus-name", sharedProps.Env, sharedProps.ServiceName),
		StringValue:   productServiceEventBus.EventBusName(),
	})
	awsssm.NewStringParameter(stack, jsii.String("ProductEventBusArn"), &awsssm.StringParameterProps{
		ParameterName: jsii.Sprintf("/%s/%s/event-bus-arn", sharedProps.Env, sharedProps.ServiceName),
		StringValue:   productServiceEventBus.EventBusArn(),
	})

	integratedEnvironments := []string{"dev", "prod"}

	if contains(integratedEnvironments, sharedProps.Env) {
		jwtSecretAccessKey := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("JwtSecretKeyParameter"), jsii.Sprintf("/%s/shared/secret-access-key", sharedProps.Env))
		eventBusParam := awsssm.StringParameter_FromStringParameterName(stack, jsii.String("EventBusNameParam"), jsii.Sprintf("/%s/shared/event-bus-name", sharedProps.Env))
		sharedEventBus := awsevents.EventBus_FromEventBusName(stack, jsii.String("SharedEventBus"), eventBusParam.StringValue())

		return ProductServiceProps{
			SharedProps:             sharedProps,
			ProductEventBus:         sharedEventBus,
			SharedEventBus:          productServiceEventBus,
			JwtSecretAccessKeyParam: jwtSecretAccessKey,
		}
	} else {
		productServiceSecretAccessKey := awsssm.NewStringParameter(stack, jsii.String("ProductJwtSecretAccessKey"), &awsssm.StringParameterProps{
			ParameterName: jsii.Sprintf("/%s/%s/secret-access-key", sharedProps.Env, sharedProps.ServiceName),
			StringValue:   jsii.String("This is a sample secret key that should not be used in production`"),
		})

		return ProductServiceProps{
			SharedProps:             sharedProps,
			ProductEventBus:         productServiceEventBus,
			SharedEventBus:          productServiceEventBus,
			JwtSecretAccessKeyParam: productServiceSecretAccessKey,
		}
	}
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
