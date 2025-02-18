package services

import (
	sharedconstructs "cdk/sharedConstructs"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type MockedSharedResourceProps struct {
	SharedProps sharedconstructs.SharedProps
}

type MockedSharedResource struct {
	SharedEventBus     awsevents.IEventBus
	JWTSecretAccessKey awsssm.IStringParameter
}

func NewMockedSharedResources(scope constructs.Construct, id string, props *MockedSharedResourceProps) *MockedSharedResource {
	if props.SharedProps.Env != "local" {
		return nil
	}

	sharedEventBus := awsevents.NewEventBus(scope, jsii.String("SharedEventBus"), &awsevents.EventBusProps{
		EventBusName: jsii.String("ProductManagementService-TestBus"),
	})

	jwtSecretAccessKey := awsssm.NewStringParameter(scope, jsii.String("JWTSecretAccessKey"), &awsssm.StringParameterProps{
		ParameterName: jsii.Sprintf("/%s/%s/JWTSecretAccessKey", props.SharedProps.ServiceName, props.SharedProps.Env),
	})

	return &MockedSharedResource{
		SharedEventBus:     sharedEventBus,
		JWTSecretAccessKey: jwtSecretAccessKey,
	}
}
