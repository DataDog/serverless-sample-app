//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package productapi

import (
	sharedprops "cdk/shared"
	sharedconstructs "cdk/sharedConstructs"
	"fmt"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsapigateway"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsdynamodb"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type ProductApiProps struct {
	sharedprops.SharedProps
}

func NewProductApi(scope constructs.Construct, id string, props *ProductApiProps) {
	productCreatedTopic := awssns.NewTopic(scope, jsii.String("GoProductCreatedTopic"), &awssns.TopicProps{})
	productUpdatedTopic := awssns.NewTopic(scope, jsii.String("GoProductUpdatedTopic"), &awssns.TopicProps{})
	productDeletedTopic := awssns.NewTopic(scope, jsii.String("GoProductDeletedTopic"), &awssns.TopicProps{})

	table := awsdynamodb.NewTable(scope, jsii.String("GoProductsTable"), &awsdynamodb.TableProps{
		TableName:   jsii.Sprintf("GoProducts-%s", props.SharedProps.Env),
		TableClass:  awsdynamodb.TableClass_STANDARD,
		BillingMode: awsdynamodb.BillingMode_PAY_PER_REQUEST,
		PartitionKey: &awsdynamodb.Attribute{
			Name: jsii.String("PK"),
			Type: awsdynamodb.AttributeType_STRING,
		},
		RemovalPolicy: awscdk.RemovalPolicy_DESTROY,
	})

	api := awsapigateway.NewRestApi(scope, jsii.String("GoProductApi"), &awsapigateway.RestApiProps{
		DefaultCorsPreflightOptions: &awsapigateway.CorsOptions{
			AllowOrigins: jsii.Strings("*"),
			AllowHeaders: jsii.Strings("*"),
			AllowMethods: jsii.Strings("ANY"),
		},
	})

	environmentVariables := make(map[string]*string)
	environmentVariables["TABLE_NAME"] = jsii.String(*table.TableName())
	environmentVariables["PRODUCT_CREATED_TOPIC_ARN"] = jsii.String(*productCreatedTopic.TopicArn())
	environmentVariables["PRODUCT_UPDATED_TOPIC_ARN"] = jsii.String(*productUpdatedTopic.TopicArn())
	environmentVariables["PRODUCT_DELETED_TOPIC_ARN"] = jsii.String(*productDeletedTopic.TopicArn())

	listProductsFunction := sharedconstructs.NewInstrumentedFunction(scope, "ListProductsFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-api/list-products/",
		FunctionName:         fmt.Sprintf("GoListProducts-%s", props.SharedProps.Env),
		EnvironmentVariables: environmentVariables,
	})

	table.GrantReadData(listProductsFunction.Function)

	createProductFunction := sharedconstructs.NewInstrumentedFunction(scope, "CreateProductFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-api/create-product/",
		FunctionName:         fmt.Sprintf("GoCreateProduct-%s", props.SharedProps.Env),
		EnvironmentVariables: environmentVariables,
	})
	table.GrantReadWriteData(createProductFunction.Function)
	productCreatedTopic.GrantPublish(createProductFunction.Function)

	getProductFunction := sharedconstructs.NewInstrumentedFunction(scope, "GetProductFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-api/get-product/",
		FunctionName:         fmt.Sprintf("GoGetProduct-%s", props.SharedProps.Env),
		EnvironmentVariables: environmentVariables,
	})

	table.GrantReadData(getProductFunction.Function)

	updateProductFunction := sharedconstructs.NewInstrumentedFunction(scope, "UpdateProductFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-api/update-product/",
		FunctionName:         fmt.Sprintf("GoUpdateProduct-%s", props.SharedProps.Env),
		EnvironmentVariables: environmentVariables,
	})
	table.GrantReadWriteData(updateProductFunction.Function)
	productUpdatedTopic.GrantPublish(updateProductFunction.Function)

	deleteProductFunction := sharedconstructs.NewInstrumentedFunction(scope, "DeleteProductFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-api/delete-product/",
		FunctionName:         fmt.Sprintf("GoDeleteProduct-%s", props.SharedProps.Env),
		EnvironmentVariables: environmentVariables,
	})
	table.GrantReadWriteData(deleteProductFunction.Function)
	productDeletedTopic.GrantPublish(deleteProductFunction.Function)

	productResource := api.Root().AddResource(jsii.String("product"), &awsapigateway.ResourceOptions{})

	productResource.AddMethod(jsii.String("GET"), awsapigateway.NewLambdaIntegration(listProductsFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})
	productResource.AddMethod(jsii.String("POST"), awsapigateway.NewLambdaIntegration(createProductFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})
	productResource.AddMethod(jsii.String("PUT"), awsapigateway.NewLambdaIntegration(updateProductFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})

	productIdResource := productResource.AddResource(jsii.String("{productId}"), &awsapigateway.ResourceOptions{})

	productIdResource.AddMethod(jsii.String("GET"), awsapigateway.NewLambdaIntegration(getProductFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})
	productIdResource.AddMethod(jsii.String("DELETE"), awsapigateway.NewLambdaIntegration(deleteProductFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})

	awsssm.NewStringParameter(scope, jsii.String("GoProductCreatedTopicArn"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/product/product-created-topic"),
		StringValue:   productCreatedTopic.TopicArn(),
	})
	awsssm.NewStringParameter(scope, jsii.String("GoProductUpdatedTopicArn"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/product/product-updated-topic"),
		StringValue:   productUpdatedTopic.TopicArn(),
	})
	awsssm.NewStringParameter(scope, jsii.String("GoProductDeletedTopicArn"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/product/product-deleted-topic"),
		StringValue:   productDeletedTopic.TopicArn(),
	})
	awsssm.NewStringParameter(scope, jsii.String("GoProductCreatedTopicName"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/product/product-created-topic-name"),
		StringValue:   productCreatedTopic.TopicName(),
	})
	awsssm.NewStringParameter(scope, jsii.String("GoProductUpdatedTopicName"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/product/product-updated-topic-name"),
		StringValue:   productUpdatedTopic.TopicName(),
	})
	awsssm.NewStringParameter(scope, jsii.String("GoProductDeletedTopicName"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/product/product-deleted-topic-name"),
		StringValue:   productDeletedTopic.TopicName(),
	})
	awsssm.NewStringParameter(scope, jsii.String("GoProductTableName"), &awsssm.StringParameterProps{
		ParameterName: jsii.String("/go/product/table-name"),
		StringValue:   table.TableName(),
	})
	awsssm.NewStringParameter(scope, jsii.String("GoProductApiEndpoint"), &awsssm.StringParameterProps{
		ParameterName: jsii.String(fmt.Sprintf("/go/%s/product/api-endpoint", props.SharedProps.Env)),
		StringValue:   api.Url(),
	})
}
