// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.APIGateway;
using Amazon.CDK.AWS.Apigatewayv2;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Amazon.CDK.AwsApigatewayv2Integrations;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Product.Api;

public record ProductApiProps(SharedProps Shared, ISecret DdApiKeySecret);

public class ProductApi : Construct
{
    public ITopic ProductCreatedTopic { get; private set; }
    public ITopic ProductUpdatedTopic { get; private set; }
    public ITopic ProductDeletedTopic { get; private set; }
    public Table Table { get; private set; }
    
    public ProductApi(Construct scope, string id, ProductApiProps props) : base(scope, id)
    {
        ProductCreatedTopic = new Topic(this, "ProductCreatedTopic", new TopicProps()
        {
            TopicName = $"DotnetProductCreatedTopic-{props.Shared.Env}"
        });
        ProductUpdatedTopic = new Topic(this, "ProductUpdatedTopic", new TopicProps()
        {
            TopicName = $"DotnetProductUpdatedTopic-{props.Shared.Env}"
        });
        ProductDeletedTopic = new Topic(this, "ProductDeletedTopic", new TopicProps()
        {
            TopicName = $"DotnetProductDeletedTopic-{props.Shared.Env}"
        });
        
        Table = new Table(this, "TracedDotnetTable", new TableProps()
        {
            TableClass = TableClass.STANDARD,
            BillingMode = BillingMode.PAY_PER_REQUEST,
            PartitionKey = new Attribute()
            {
                Name = "PK",
                Type = AttributeType.STRING
            },
            RemovalPolicy = RemovalPolicy.DESTROY
        });

        var apiEnvironmentVariables = new Dictionary<string, string>(2)
        {
            { "PRODUCT_CREATED_TOPIC_ARN", ProductCreatedTopic.TopicArn },
            { "PRODUCT_UPDATED_TOPIC_ARN", ProductUpdatedTopic.TopicArn },
            { "PRODUCT_DELETED_TOPIC_ARN", ProductDeletedTopic.TopicArn },
            { "TABLE_NAME", Table.TableName },
        };
        
        var listProductsFunction = new InstrumentedFunction(this, "ListProductsFunction",
            new FunctionProps(props.Shared,"ListProducts", "../src/Product.Api/ProductApi.Adapters/",
                "ProductApi.Adapters::ProductApi.Adapters.ApiFunctions_ListProducts_Generated::ListProducts", apiEnvironmentVariables, props.DdApiKeySecret));
        Table.GrantReadData(listProductsFunction.Function);
        
        var getProductFunction = new InstrumentedFunction(this, "GetProductFunction",
            new FunctionProps(props.Shared,"GetProduct", "../src/Product.Api/ProductApi.Adapters/",
                "ProductApi.Adapters::ProductApi.Adapters.ApiFunctions_GetProduct_Generated::GetProduct", apiEnvironmentVariables, props.DdApiKeySecret));
        Table.GrantReadData(getProductFunction.Function);
        
        var createProductFunction = new InstrumentedFunction(this, "CreateProductFunction",
            new FunctionProps(props.Shared,"CreateProduct", "../src/Product.Api/ProductApi.Adapters/",
                "ProductApi.Adapters::ProductApi.Adapters.ApiFunctions_CreateProduct_Generated::CreateProduct", apiEnvironmentVariables, props.DdApiKeySecret));
        
        var deleteProductFunction = new InstrumentedFunction(this, "DeleteProductFunction",
            new FunctionProps(props.Shared,"DeleteProduct", "../src/Product.Api/ProductApi.Adapters/",
                "ProductApi.Adapters::ProductApi.Adapters.ApiFunctions_DeleteProduct_Generated::DeleteProduct", apiEnvironmentVariables, props.DdApiKeySecret));
        
        var updateProductFunction = new InstrumentedFunction(this, "UpdateProductFunction",
            new FunctionProps(props.Shared,"UpdateProduct", "../src/Product.Api/ProductApi.Adapters/",
                "ProductApi.Adapters::ProductApi.Adapters.ApiFunctions_UpdateProduct_Generated::UpdateProduct", apiEnvironmentVariables, props.DdApiKeySecret));
        
        Table.GrantReadWriteData(updateProductFunction.Function);
        
        Table.GrantReadWriteData(createProductFunction.Function);
        Table.GrantReadWriteData(deleteProductFunction.Function);
        ProductCreatedTopic.GrantPublish(createProductFunction.Function);
        ProductUpdatedTopic.GrantPublish(updateProductFunction.Function);
        ProductDeletedTopic.GrantPublish(deleteProductFunction.Function);
        
        var httpAPi = new RestApi(this, "TracedDotnetApi", new RestApiProps()
        {
            DefaultCorsPreflightOptions = new CorsOptions()
            {
                AllowHeaders = ["*"],
                AllowOrigins = ["http://localhost:8080"],
                AllowMethods = ["GET", "POST", "PUT", "DELETE"],
            }
        });
        var productResource = httpAPi.Root.AddResource("product");
        productResource.AddMethod("GET", new LambdaIntegration(listProductsFunction.Function));
        productResource.AddMethod("POST", new LambdaIntegration(createProductFunction.Function));
        productResource.AddMethod("PUT", new LambdaIntegration(updateProductFunction.Function));
        
        var specificProductResource = productResource.AddResource("{productId}");
        specificProductResource.AddMethod("GET", new LambdaIntegration(getProductFunction.Function));
        specificProductResource.AddMethod("DELETE", new LambdaIntegration(deleteProductFunction.Function));
        

        var productCreatedTopicArnParameter = new StringParameter(this, "ProductCreatedTopicArnParameter",
            new StringParameterProps()
            {
                ParameterName = "/dotnet/product-api/product-created-topic",
                StringValue = ProductCreatedTopic.TopicArn
            });
        var productUpdatedTopicArnParameter = new StringParameter(this, "ProductUpdatedTopicArnParameter",
            new StringParameterProps()
            {
                ParameterName = "/dotnet/product-api/product-updated-topic",
                StringValue = ProductUpdatedTopic.TopicArn
            });
        var productDeletedTopicArnParameter = new StringParameter(this, "ProductDeletedTopicArnParameter",
            new StringParameterProps()
            {
                ParameterName = "/dotnet/product-api/product-deleted-topic",
                StringValue = ProductDeletedTopic.TopicArn
            });
        var tableArnParameter = new StringParameter(this, "ProductTableArnParameter",
            new StringParameterProps()
            {
                ParameterName = "/dotnet/product-api/table-arn",
                StringValue = Table.TableArn
            });
        var apiEndpointParameter = new StringParameter(this, "ProductApiEndpointParameter",
            new StringParameterProps()
            {
                ParameterName = $"/dotnet/{props.Shared.Env}/product/api-endpoint",
                StringValue = httpAPi.Url
            });
    }
}