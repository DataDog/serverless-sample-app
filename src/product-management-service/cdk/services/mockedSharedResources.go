package services

import (
	sharedconstructs "cdk/sharedConstructs"
	"github.com/Microsoft/go-winio/pkg/guid"
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

	sharedEventBus := awsevents.NewEventBus(scope, jsii.String("ProductManagementServiceBus"), &awsevents.EventBusProps{
		EventBusName: jsii.Sprintf("%s-TestBus-%s", props.SharedProps.ServiceName, props.SharedProps.Env),
	})

	newGuid, _ := guid.NewV4()

	jwtSecretAccessKey := awsssm.NewStringParameter(scope, jsii.String("ProductManagementServiceBusJWTSecretAccessKey"), &awsssm.StringParameterProps{
		ParameterName: jsii.Sprintf("/%s/%s/JWTSecretAccessKey", props.SharedProps.ServiceName, props.SharedProps.Env),
		StringValue:   jsii.String(newGuid.String()),
	})

	return &MockedSharedResource{
		SharedEventBus:     sharedEventBus,
		JWTSecretAccessKey: jwtSecretAccessKey,
	}
}
