using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.Apigatewayv2;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AwsApigatewayv2Integrations;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Product.Api;

public record ProductApiProps(string ServiceName, string Env, string Version, ISecret DdApiKeySecret);

public class ProductApi : Construct
{
    public ITopic ProductCreatedTopic { get; private set; }
    public ITopic ProductUpdatedTopic { get; private set; }
    public ITopic ProductDeletedTopic { get; private set; }
    public ITable Table { get; private set; }
    
    public ProductApi(Construct scope, string id, ProductApiProps props) : base(scope, id)
    {
        ProductCreatedTopic = new Topic(this, "ProductCreatedTopic");
        ProductUpdatedTopic = new Topic(this, "ProductUpdatedTopic");
        ProductDeletedTopic = new Topic(this, "ProductDeletedTopic");
        
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
        
        var getProductFunction = new InstrumentedFunction(this, "GetProductFunction",
            new FunctionProps(props.ServiceName, props.Env, props.Version,"GetProduct", "../src/Product.Api/Product.Api.Lambda/",
                "Product.Api::Product.Api.Functions_GetProduct_Generated::GetProduct", apiEnvironmentVariables, props.DdApiKeySecret));
        var getProductIntegration = new HttpLambdaIntegration("GetProductIntegration", getProductFunction.Function);
        Table.GrantReadData(getProductFunction.Function);

        var createProductFunction = new InstrumentedFunction(this, "CreateProductFunction",
            new FunctionProps(props.ServiceName, props.Env, props.Version,"CreateProduct", "../src/Product.Api/Product.Api.Lambda/",
                "Product.Api::Product.Api.Functions_CreateProduct_Generated::CreateProduct", apiEnvironmentVariables, props.DdApiKeySecret));
        
        var createProductIntegration = new HttpLambdaIntegration("CreateProductIntegration", createProductFunction.Function);
        
        var deleteProductFunction = new InstrumentedFunction(this, "DeleteProductFunction",
            new FunctionProps(props.ServiceName, props.Env, props.Version,"DeleteProduct", "../src/Product.Api/Product.Api.Lambda/",
                "Product.Api::Product.Api.Functions_DeleteProduct_Generated::DeleteProduct", apiEnvironmentVariables, props.DdApiKeySecret));
        
        var deleteProductIntegration = new HttpLambdaIntegration("DeleteProductIntegration", deleteProductFunction.Function);
        
        var updateProductFunction = new InstrumentedFunction(this, "UpdateProductFunction",
            new FunctionProps(props.ServiceName, props.Env, props.Version,"UpdateProduct", "../src/Product.Api/Product.Api.Lambda/",
                "Product.Api::Product.Api.Functions_UpdateProduct_Generated::UpdateProduct", apiEnvironmentVariables, props.DdApiKeySecret));
        
        var updateProductIntegration = new HttpLambdaIntegration("UpdateProductIntegration", updateProductFunction.Function);

        Table.GrantReadData(updateProductFunction.Function);
        Table.GrantWriteData(updateProductFunction.Function);
        
        Table.GrantWriteData(createProductFunction.Function);
        Table.GrantWriteData(deleteProductFunction.Function);
        ProductCreatedTopic.GrantPublish(createProductFunction.Function);
        ProductUpdatedTopic.GrantPublish(updateProductFunction.Function);
        ProductDeletedTopic.GrantPublish(deleteProductFunction.Function);
        
        var httpAPi = new HttpApi(this, "TracedDotnetApi");
        httpAPi.AddRoutes(new AddRoutesOptions()
        {
            Path = "/product",
            Methods = [HttpMethod.POST],
            Integration = createProductIntegration
        });
        httpAPi.AddRoutes(new AddRoutesOptions()
        {
            Path = "/product",
            Methods = [HttpMethod.PUT],
            Integration = updateProductIntegration
        });
        httpAPi.AddRoutes(new AddRoutesOptions()
        {
            Path = "/product/{productId}",
            Methods = [HttpMethod.GET],
            Integration = getProductIntegration
        });
        httpAPi.AddRoutes(new AddRoutesOptions()
        {
            Path = "/product/{productId}",
            Methods = [HttpMethod.DELETE],
            Integration = deleteProductIntegration
        });
    }
}