//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package services

import (
	sharedconstructs "cdk/sharedConstructs"

	"github.com/aws/aws-cdk-go/awscdk/v2"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsapigateway"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsdynamodb"
	"github.com/aws/aws-cdk-go/awscdk/v2/awssns"
	"github.com/aws/aws-cdk-go/awscdk/v2/awsssm"
	"github.com/aws/constructs-go/constructs/v10"
	"github.com/aws/jsii-runtime-go"
)

type ProductApiProps struct {
	sharedconstructs.SharedProps
	JwtSecretAccessKeyParameter awsssm.IStringParameter
}

type ProductApi struct {
	Table               awsdynamodb.Table
	ProductCreatedTopic awssns.Topic
	ProductUpdatedTopic awssns.Topic
	ProductDeletedTopic awssns.Topic
}

func NewProductApi(scope constructs.Construct, id string, props *ProductApiProps) ProductApi {
	productCreatedTopic := awssns.NewTopic(scope, jsii.String("ProductCreatedTopic"), &awssns.TopicProps{})
	productUpdatedTopic := awssns.NewTopic(scope, jsii.String("ProductUpdatedTopic"), &awssns.TopicProps{})
	productDeletedTopic := awssns.NewTopic(scope, jsii.String("ProductDeletedTopic"), &awssns.TopicProps{})

	table := awsdynamodb.NewTable(scope, jsii.String("ProductsTable"), &awsdynamodb.TableProps{
		TableName:   jsii.Sprintf("%s-Products-%s", props.SharedProps.ServiceName, props.SharedProps.Env),
		TableClass:  awsdynamodb.TableClass_STANDARD,
		BillingMode: awsdynamodb.BillingMode_PAY_PER_REQUEST,
		PartitionKey: &awsdynamodb.Attribute{
			Name: jsii.String("PK"),
			Type: awsdynamodb.AttributeType_STRING,
		},
		RemovalPolicy: awscdk.RemovalPolicy_DESTROY,
	})

	api := awsapigateway.NewRestApi(scope, jsii.String("ProductApi"), &awsapigateway.RestApiProps{
		RestApiName: jsii.Sprintf("%s-Api-%s", props.SharedProps.ServiceName, props.SharedProps.Env),
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
	environmentVariables["JWT_SECRET_PARAM_NAME"] = props.JwtSecretAccessKeyParameter.ParameterName()

	listProductsFunction := sharedconstructs.NewInstrumentedFunction(scope, "ListProductsFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-api/list-products/",
		FunctionName:         "ListProducts",
		EnvironmentVariables: environmentVariables,
	})

	table.GrantReadWriteData(listProductsFunction.Function)
	productCreatedTopic.GrantPublish(listProductsFunction.Function)

	createProductFunction := sharedconstructs.NewInstrumentedFunction(scope, "CreateProductFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-api/create-product/",
		FunctionName:         "CreateProduct",
		EnvironmentVariables: environmentVariables,
	})
	table.GrantReadWriteData(createProductFunction.Function)
	productCreatedTopic.GrantPublish(createProductFunction.Function)
	props.JwtSecretAccessKeyParameter.GrantRead(createProductFunction.Function)

	getProductFunction := sharedconstructs.NewInstrumentedFunction(scope, "GetProductFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-api/get-product/",
		FunctionName:         "GetProduct",
		EnvironmentVariables: environmentVariables,
	})

	table.GrantReadData(getProductFunction.Function)

	updateProductFunction := sharedconstructs.NewInstrumentedFunction(scope, "UpdateProductFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-api/update-product/",
		FunctionName:         "UpdateProduct",
		EnvironmentVariables: environmentVariables,
	})
	table.GrantReadWriteData(updateProductFunction.Function)
	productUpdatedTopic.GrantPublish(updateProductFunction.Function)
	props.JwtSecretAccessKeyParameter.GrantRead(updateProductFunction.Function)

	deleteProductFunction := sharedconstructs.NewInstrumentedFunction(scope, "DeleteProductFunction", &sharedconstructs.InstrumentedFunctionProps{
		SharedProps:          props.SharedProps,
		Entry:                "../src/product-api/delete-product/",
		FunctionName:         "DeleteProdut",
		EnvironmentVariables: environmentVariables,
	})
	table.GrantReadWriteData(deleteProductFunction.Function)
	productDeletedTopic.GrantPublish(deleteProductFunction.Function)
	props.JwtSecretAccessKeyParameter.GrantRead(deleteProductFunction.Function)

	productResource := api.Root().AddResource(jsii.String("product"), &awsapigateway.ResourceOptions{})

	productResource.AddMethod(jsii.String("GET"), awsapigateway.NewLambdaIntegration(listProductsFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})
	productResource.AddMethod(jsii.String("POST"), awsapigateway.NewLambdaIntegration(createProductFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})
	productResource.AddMethod(jsii.String("PUT"), awsapigateway.NewLambdaIntegration(updateProductFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})

	productIdResource := productResource.AddResource(jsii.String("{productId}"), &awsapigateway.ResourceOptions{})

	productIdResource.AddMethod(jsii.String("GET"), awsapigateway.NewLambdaIntegration(getProductFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})
	productIdResource.AddMethod(jsii.String("DELETE"), awsapigateway.NewLambdaIntegration(deleteProductFunction.Function, &awsapigateway.LambdaIntegrationOptions{}), &awsapigateway.MethodOptions{})

	awsssm.NewStringParameter(scope, jsii.String("ProductApiEndpoint"), &awsssm.StringParameterProps{
		ParameterName: jsii.Sprintf("/%s/%s/api-endpoint", props.SharedProps.Env, props.SharedProps.ServiceName),
		StringValue:   api.Url(),
	})

	return ProductApi{
		Table:               table,
		ProductCreatedTopic: productCreatedTopic,
		ProductUpdatedTopic: productUpdatedTopic,
		ProductDeletedTopic: productDeletedTopic,
	}
}
