using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.Apigatewayv2;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AwsApigatewayv2Integrations;
using Constructs;

namespace DotnetLambdaHybridTracing;

public record ApiProps(string ServiceName, string Env, string Version, ISecret DdApiKeySecret);

public class Api : Construct
{
    public ITopic Topic { get; private set; }
    public ITable Table { get; private set; }
    
    public Api(Construct scope, string id, ApiProps props) : base(scope, id)
    {
        Topic = new Topic(this, "TracedDotnetTopic");
        
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
            { "SNS_TOPIC_ARN", Topic.TopicArn },
            { "TABLE_NAME", Table.TableName },
        };
        
        var getOrderFunction = new InstrumentedFunction(this, "GetOrderFunction",
            new FunctionProps(props.ServiceName, props.Env, props.Version,"GetOrder", "./functions/api",
                "Api::Api.Functions_GetOrder_Generated::GetOrder", apiEnvironmentVariables, props.DdApiKeySecret));
        var getOrderIntegration = new HttpLambdaIntegration("GetOrderIntegration", getOrderFunction.Function);
        Table.GrantReadData(getOrderFunction.Function);

        var createOrderFunction = new InstrumentedFunction(this, "CreateOrderFunction",
            new FunctionProps(props.ServiceName, props.Env, props.Version,"CreateOrder", "./functions/api",
                "Api::Api.Functions_CreateOrder_Generated::CreateOrder", apiEnvironmentVariables, props.DdApiKeySecret));
        var createOrderIntegration = new HttpLambdaIntegration("CreateOrderIntegration", createOrderFunction.Function);
        Table.GrantWriteData(createOrderFunction.Function);
        Topic.GrantPublish(createOrderFunction.Function);
        
        var httpAPi = new HttpApi(this, "TracedDotnetApi");
        httpAPi.AddRoutes(new AddRoutesOptions()
        {
            Path = "/order",
            Methods = [HttpMethod.POST],
            Integration = createOrderIntegration
        });
        httpAPi.AddRoutes(new AddRoutesOptions()
        {
            Path = "/order/{orderId}",
            Methods = [HttpMethod.GET],
            Integration = getOrderIntegration
        });
    }
}