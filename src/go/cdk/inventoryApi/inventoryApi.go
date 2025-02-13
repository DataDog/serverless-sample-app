//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package inventoryapi

import (
	sharedprops "cdk/shared"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsdynamodb"
	"github.com/aws/aws-cdk-go/awscdk/v2/awselasticloadbalancingv2"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsec2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsecs"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsecspatterns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsiam"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type InventoryApiProps struct {
	sharedprops.SharedProps
	sharedEventBus awsevents.IEventBus
}

func NewInventoryApi(scope constructs.Construct, id string, props *InventoryApiProps) {
	vpc := awsec2.NewVpc(scope, jsii.String("GoInventoryApiVpc"), &awsec2.VpcProps{
		MaxAzs: jsii.Number(2),
	})

	cluster := awsecs.NewCluster(scope, jsii.String("GoInventoryApiCluster"), &awsecs.ClusterProps{
		Vpc: vpc,
	})

	table := awsdynamodb.NewTable(scope, jsii.String("GoInventoryApiTable"), &awsdynamodb.TableProps{
		TableName:   jsii.String("GoInventoryApi-" + props.SharedProps.Env),
		TableClass:  awsdynamodb.TableClass_STANDARD,
		BillingMode: awsdynamodb.BillingMode_PAY_PER_REQUEST,
		PartitionKey: &awsdynamodb.Attribute{
			Name: jsii.String("PK"),
			Type: awsdynamodb.AttributeType_STRING,
		},
		RemovalPolicy: awscdk.RemovalPolicy_DESTROY,
	})

	awsssm.NewStringParameter(scope, jsii.String("GoInventoryApiTableNameParameter"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/" + props.SharedProps.Env + "/inventory-api/table-name"),
		StringValue:   table.TableName(),
	})

	executionRole := awsiam.NewRole(scope, jsii.String("GoInventoryApiExecutionRole"), &awsiam.RoleProps{
		AssumedBy: awsiam.NewServicePrincipal(jsii.String("ecs-tasks.amazonaws.com"), nil),
	})
	executionRole.AddManagedPolicy(awsiam.ManagedPolicy_FromAwsManagedPolicyName(jsii.String("service-role/AmazonECSTaskExecutionRolePolicy")))

	application := awsecspatterns.NewApplicationLoadBalancedFargateService(scope, jsii.String("GoInventoryApiService"), &awsecspatterns.ApplicationLoadBalancedFargateServiceProps{
		Cluster:      cluster,
		DesiredCount: jsii.Number(2),
		RuntimePlatform: &awsecs.RuntimePlatform{
			CpuArchitecture:       awsecs.CpuArchitecture_ARM64(),
			OperatingSystemFamily: awsecs.OperatingSystemFamily_LINUX(),
		},
		TaskImageOptions: &awsecspatterns.ApplicationLoadBalancedTaskImageOptions{
			Image:         awsecs.ContainerImage_FromRegistry(jsii.String("public.ecr.aws/k4y9x2e7/dd-serverless-sample-app-go:latest"), nil),
			ExecutionRole: executionRole,
			Environment: &map[string]*string{
				"TABLE_NAME":     table.TableName(),
				"EVENT_BUS_NAME": props.sharedEventBus.EventBusName(),
				"TEAM":           jsii.String("inventory"),
				"DOMAIN":         jsii.String("inventory"),
				"ENV":            jsii.String(props.SharedProps.Env),
				"DD_ENV":         jsii.String(props.SharedProps.Env),
				"DD_SERVICE":     jsii.String(props.SharedProps.ServiceName),
				"DD_VERSION":     jsii.String(props.SharedProps.Version),
			},
			ContainerPort: jsii.Number(8080),
			ContainerName: jsii.String("GoInventoryApi"),
			LogDriver: awsecs.LogDrivers_Firelens(&awsecs.FireLensLogDriverProps{
				Options: &map[string]*string{
					"Name":           jsii.String("datadog"),
					"Host":           jsii.String("http-intake.logs.datadoghq.eu"),
					"TLS":            jsii.String("on"),
					"dd_service":     jsii.String(props.SharedProps.ServiceName),
					"dd_source":      jsii.String("expressjs"),
					"dd_message_key": jsii.String("log"),
					"provider":       jsii.String("ecs"),
					"apikey":         props.SharedProps.DDApiKeySecret.SecretValue().UnsafeUnwrap(),
				},
			}),
		},
		MemoryLimitMiB:     jsii.Number(512),
		PublicLoadBalancer: jsii.Bool(true),
	})

	application.TaskDefinition().AddFirelensLogRouter(jsii.String("firelens"), &awsecs.FirelensLogRouterDefinitionOptions{
		Essential:     jsii.Bool(true),
		Image:         awsecs.ContainerImage_FromRegistry(jsii.String("amazon/aws-for-fluent-bit:stable"), nil),
		ContainerName: jsii.String("log-router"),
		FirelensConfig: &awsecs.FirelensConfig{
			Type: awsecs.FirelensLogRouterType_FLUENTBIT,
			Options: &awsecs.FirelensOptions{
				EnableECSLogMetadata: jsii.Bool(true),
			},
		},
	})

	table.GrantReadWriteData(application.TaskDefinition().TaskRole())
	props.sharedEventBus.GrantPutEventsTo(application.TaskDefinition().TaskRole())
	props.SharedProps.DDApiKeySecret.GrantRead(application.TaskDefinition().TaskRole(), nil)
	props.SharedProps.DDApiKeySecret.GrantRead(executionRole, nil)

	application.TargetGroup().ConfigureHealthCheck(&awselasticloadbalancingv2.HealthCheck{
		Port:                    jsii.String("8080"),
		Path:                    jsii.String("/health"),
		HealthyHttpCodes:        jsii.String("200-499"),
		Timeout:                 awscdk.Duration_Seconds(jsii.Number(30)),
		Interval:                awscdk.Duration_Seconds(jsii.Number(60)),
		UnhealthyThresholdCount: jsii.Number(5),
		HealthyThresholdCount:   jsii.Number(2),
	})

	application.TaskDefinition().AddContainer(jsii.String("Datadog"), &awsecs.ContainerDefinitionOptions{
		Image: awsecs.ContainerImage_FromRegistry(jsii.String("public.ecr.aws/datadog/agent:latest"), nil),
		PortMappings: &[]*awsecs.PortMapping{
			{ContainerPort: jsii.Number(8125), HostPort: jsii.Number(8125)},
			{ContainerPort: jsii.Number(8126), HostPort: jsii.Number(8126)},
		},
		ContainerName: jsii.String("datadog-agent"),
		Environment: &map[string]*string{
			"DD_SITE":                        jsii.String("datadoghq.eu"),
			"ECS_FARGATE":                    jsii.String("true"),
			"DD_LOGS_ENABLED":                jsii.String("false"),
			"DD_PROCESS_AGENT_ENABLED":       jsii.String("true"),
			"DD_APM_ENABLED":                 jsii.String("true"),
			"DD_APM_NON_LOCAL_TRAFFIC":       jsii.String("true"),
			"DD_DOGSTATSD_NON_LOCAL_TRAFFIC": jsii.String("true"),
			"DD_ECS_TASK_COLLECTION_ENABLED": jsii.String("true"),
			"DD_ENV":                         jsii.String(props.SharedProps.Env),
			"DD_SERVICE":                     jsii.String(props.SharedProps.ServiceName),
			"DD_VERSION":                     jsii.String(props.SharedProps.Version),
			"DD_APM_IGNORE_RESOURCES":        jsii.String("GET /health"),
		},
		Secrets: &map[string]awsecs.Secret{
			"DD_API_KEY": awsecs.Secret_FromSecretsManager(props.SharedProps.DDApiKeySecret, nil),
		},
	})
}
