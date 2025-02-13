//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package shared

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
