package sharedconstructs

import (
	"github.com/DataDog/datadog-cdk-constructs-go/ddcdkconstruct"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssecretsmanager"
)

type SharedProps struct {
	Env            string
	ServiceName    string
	Version        string
	Datadog        ddcdkconstruct.Datadog
	DDApiKeySecret awssecretsmanager.ISecret
}
