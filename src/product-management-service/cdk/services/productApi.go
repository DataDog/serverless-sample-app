//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package services

import (
	sharedconstructs "cdk/sharedConstructs"
	"fmt"

	"github.com/aws/aws-cdk-go/awscdk/v2/awsiam"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsapigateway"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsdsql"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsevents"
	"github.com/aws/aws-cdk-go/awscdk/v2/awseventstargets"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type ProductApiProps struct {
	ServiceProps ProductServiceProps
}

type ProductApi struct {
	Database                    awsdsql.CfnCluster
	DatabaseClusterAccessPolicy awsiam.Policy
	DatabaseClusterEndpoint     *string
	ProductCreatedTopic         awssns.Topic
	ProductUpdatedTopic         awssns.Topic
	ProductDeletedTopic         awssns.Topic
}

func NewProductApi(scope constructs.Construct, id string, props *ProductApiProps) ProductApi {
	region := awscdk.Stack_Of(scope).Region()

	productCreatedTopic := awssns.NewTopic(scope, jsii.String("ProductCreatedTopic"), &awssns.TopicProps{})
	productUpdatedTopic := awssns.NewTopic(scope, jsii.String("ProductUpdatedTopic"), &awssns.TopicProps{})
	productDeletedTopic := awssns.NewTopic(scope, jsii.String("ProductDeletedTopic"), &awssns.TopicProps{})

	dsqlCluster := awsdsql.NewCfnCluster(scope, jsii.String("DSQLCluster"), &awsdsql.CfnClusterProps{
		DeletionProtectionEnabled: jsii.Bool(false),
	})
	databaseClusterEndpoint := jsii.String(fmt.Sprintf("%s.dsql.%s.on.aws", *dsqlCluster.GetAtt(jsii.String("Identifier"), awscdk.ResolutionTypeHint_STRING).ToString(), *region))
	clusterIdentifier := dsqlCluster.GetAtt(jsii.String("Identifier"), awscdk.ResolutionTypeHint_STRING).ToString()
	clusterArn := jsii.String(fmt.Sprintf("arn:aws:dsql:%s:%s:cluster/%s", *region, *awscdk.Stack_Of(scope).Account(), *clusterIdentifier))
	dsqlConnectPolicyStatement := awsiam.NewPolicyStatement(&awsiam.PolicyStatementProps{
		Effect:    awsiam.Effect_ALLOW,
		Actions:   jsii.Strings("dsql:DbConnectAdmin"),
		Resources: jsii.Strings(*clusterArn),
	})

	// Create the policy
	dSqlConnectPolicy := awsiam.NewPolicy(scope, jsii.String("DbConnectPolicy"), &awsiam.PolicyProps{
		Statements: &[]awsiam.PolicyStatement{dsqlConnectPolicyStatement},
	})

	api := awsapigateway.NewRestApi(scope, jsii.String("ProductApi"), &awsapigateway.RestApiProps{
		RestApiName: jsii.Sprintf("%s-Api-%s", props.ServiceProps.SharedProps.ServiceName, props.ServiceProps.SharedProps.Env),
		DefaultCorsPreflightOptions: &awsapigateway.CorsOptions{
			AllowOrigins: jsii.Strings("*"),
			AllowHeaders: jsii.Strings("*"),
			AllowMethods: jsii.Strings("ANY"),
		},
	})

	environmentVariables := make(map[string]*string)
	environmentVariables["JWT_SECRET_PARAM_NAME"] = props.ServiceProps.JwtSecretAccessKeyParam.ParameterName()
	environmentVariables["DSQL_CLUSTER_ENDPOINT"] = databaseClusterEndpoint

	listProductsFunction := sharedconstructs.NewInstrumentedFunction(scope, "ListProductsFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.ServiceProps.SharedProps,
		Entry:                "../src/product-api/list-products/",
		FunctionName:         "ListProducts",
		EnvironmentVariables: environmentVariables,
	})

	listProductsFunction.Function.Role().AttachInlinePolicy(dSqlConnectPolicy)

	createProductFunction := sharedconstructs.NewInstrumentedFunction(scope, "CreateProductFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.ServiceProps.SharedProps,
		Entry:                "../src/product-api/create-product/",
		FunctionName:         "CreateProduct",
		EnvironmentVariables: environmentVariables,
	})
	props.ServiceProps.JwtSecretAccessKeyParam.GrantRead(createProductFunction.Function)
	createProductFunction.Function.Role().AttachInlinePolicy(dSqlConnectPolicy)

	getProductFunction := sharedconstructs.NewInstrumentedFunction(scope, "GetProductFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.ServiceProps.SharedProps,
		Entry:                "../src/product-api/get-product/",
		FunctionName:         "GetProduct",
		EnvironmentVariables: environmentVariables,
	})
	getProductFunction.Function.Role().AttachInlinePolicy(dSqlConnectPolicy)

	updateProductFunction := sharedconstructs.NewInstrumentedFunction(scope, "UpdateProductFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.ServiceProps.SharedProps,
		Entry:                "../src/product-api/update-product/",
		FunctionName:         "UpdateProduct",
		EnvironmentVariables: environmentVariables,
	})
	props.ServiceProps.JwtSecretAccessKeyParam.GrantRead(updateProductFunction.Function)
	updateProductFunction.Function.Role().AttachInlinePolicy(dSqlConnectPolicy)

	deleteProductFunction := sharedconstructs.NewInstrumentedFunction(scope, "DeleteProductFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.ServiceProps.SharedProps,
		Entry:                "../src/product-api/delete-product/",
		FunctionName:         "DeleteProduct",
		EnvironmentVariables: environmentVariables,
	})
	props.ServiceProps.JwtSecretAccessKeyParam.GrantRead(deleteProductFunction.Function)
	deleteProductFunction.Function.Role().AttachInlinePolicy(dSqlConnectPolicy)

	// Create outbox processor function
	outboxProcessorEnvironmentVariables := make(map[string]*string)
	outboxProcessorEnvironmentVariables["PRODUCT_CREATED_TOPIC_ARN"] = jsii.String(*productCreatedTopic.TopicArn())
	outboxProcessorEnvironmentVariables["PRODUCT_UPDATED_TOPIC_ARN"] = jsii.String(*productUpdatedTopic.TopicArn())
	outboxProcessorEnvironmentVariables["PRODUCT_DELETED_TOPIC_ARN"] = jsii.String(*productDeletedTopic.TopicArn())
	outboxProcessorEnvironmentVariables["DSQL_CLUSTER_ENDPOINT"] = databaseClusterEndpoint

	outboxProcessorFunction := sharedconstructs.NewInstrumentedFunction(scope, "OutboxProcessorFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.ServiceProps.SharedProps,
		Entry:                "../src/product-api/outbox-processor/",
		FunctionName:         "OutboxProcessor",
		EnvironmentVariables: outboxProcessorEnvironmentVariables,
	})

	// Grant permissions to publish to all topics
	productCreatedTopic.GrantPublish(outboxProcessorFunction.Function)
	productUpdatedTopic.GrantPublish(outboxProcessorFunction.Function)
	productDeletedTopic.GrantPublish(outboxProcessorFunction.Function)
	outboxProcessorFunction.Function.Role().AttachInlinePolicy(dSqlConnectPolicy)

	// Create EventBridge rule to trigger outbox processor every 5 minutes
	sixty_seconds := float64(60.0)
	outboxProcessorRule := awsevents.NewRule(scope, jsii.String("OutboxProcessorRule"), &awsevents.RuleProps{
		Schedule:    awsevents.Schedule_Rate(awscdk.Duration_Seconds(&sixty_seconds)),
		Description: jsii.String("Trigger outbox processor every 5 minutes"),
	})

	outboxProcessorRule.AddTarget(awseventstargets.NewLambdaFunction(outboxProcessorFunction.Function, &awseventstargets.LambdaFunctionProps{}))

	productResource := api.Root().AddResource(jsii.String("product"), &awsapigateway.ResourceOptions{})

	productResource.AddMethod(jsii.String("GET"), awsapigateway.NewLambdaIntegration(listProductsFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})
	productResource.AddMethod(jsii.String("POST"), awsapigateway.NewLambdaIntegration(createProductFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})
	productResource.AddMethod(jsii.String("PUT"), awsapigateway.NewLambdaIntegration(updateProductFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})

	productIdResource := productResource.AddResource(jsii.String("{productId}"), &awsapigateway.ResourceOptions{})

	productIdResource.AddMethod(jsii.String("GET"), awsapigateway.NewLambdaIntegration(getProductFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})
	productIdResource.AddMethod(jsii.String("DELETE"), awsapigateway.NewLambdaIntegration(deleteProductFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})

	awsssm.NewStringParameter(scope, jsii.String("ProductApiEndpoint"), &awsssm.StringParameterProps{
		ParameterName: jsii.Sprintf("/%s/%s/api-endpoint", props.ServiceProps.SharedProps.Env, props.ServiceProps.SharedProps.ServiceName),
		StringValue:   api.Url(),
	})

	awsssm.NewStringParameter(scope, jsii.String("ProductDbClusterEndpoint"), &awsssm.StringParameterProps{
		ParameterName: jsii.Sprintf("/%s/%s/cluster-endpoint", props.ServiceProps.SharedProps.Env, props.ServiceProps.SharedProps.ServiceName),
		StringValue:   databaseClusterEndpoint,
	})

	return ProductApi{
		DatabaseClusterEndpoint:     databaseClusterEndpoint,
		DatabaseClusterAccessPolicy: dSqlConnectPolicy,
		Database:                    dsqlCluster,
		ProductCreatedTopic:         productCreatedTopic,
		ProductUpdatedTopic:         productUpdatedTopic,
		ProductDeletedTopic:         productDeletedTopic,
	}
}
