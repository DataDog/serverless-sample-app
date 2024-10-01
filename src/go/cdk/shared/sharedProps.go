package shared

import "github.com/DataDog/datadog-cdk-constructs-go/ddcdkconstruct"

type SharedProps struct {
	Env         string
	ServiceName string
	Version     string
	Datadog     ddcdkconstruct.Datadog
}
