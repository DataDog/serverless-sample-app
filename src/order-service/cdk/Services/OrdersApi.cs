// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System;
using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.APIGateway;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.EC2;
using Amazon.CDK.AWS.ECS;
using Amazon.CDK.AWS.ECS.Patterns;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.IAM;
using Amazon.CDK.AWS.Lambda;
using Amazon.CDK.AWS.Logs;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.SSM;
using Amazon.CDK.AWS.StepFunctions;
using Constructs;
using OrdersService.CDK.Constructs;
using Attribute = Amazon.CDK.AWS.DynamoDB.Attribute;
using FunctionProps = OrdersService.CDK.Constructs.FunctionProps;
using HealthCheck = Amazon.CDK.AWS.ElasticLoadBalancingV2.HealthCheck;
using Policy = Amazon.CDK.AWS.IAM.Policy;

namespace OrdersService.CDK.Services;

public record OrdersApiProps(
    SharedProps SharedProps,
    OrderServiceProps ServiceProps);

public class OrdersApi : Construct
{
    public ITopic OrderCreatedTopic { get; private set; }
    public Table OrdersTable { get; private set; }
    public IStateMachine OrdersWorkflow { get; private set; }

    private void CreateOrderWorkflow(OrdersApiProps props, PolicyStatement describeBusPolicyStatement)
    {
        var environmentVariables = new Dictionary<string, string>(2)
        {
            { "EVENT_BUS_NAME", props.ServiceProps.PublisherBus.EventBusName },
            { "TABLE_NAME", OrdersTable.TableName }
        };

        var confirmOrderHandler = CreateConfirmOrderHandler(props, environmentVariables);
        ((Role)confirmOrderHandler.Role).AddToPolicy(describeBusPolicyStatement);

        var noStockHandler = CreateNoStockHandler(props, environmentVariables);
        ((Role)noStockHandler.Role).AddToPolicy(describeBusPolicyStatement);

        var workflowLogGroup = new LogGroup(this, "InventoryOrderingWorkflowLogGroup", new LogGroupProps()
        {
            LogGroupName =
                $"/aws/vendedlogs/states/{props.SharedProps.ServiceName}-OrderWorkflow-{props.SharedProps.Env}-Logs",
            RemovalPolicy = RemovalPolicy.DESTROY
        });

        var workflowFilePath = "workflows/orderProcessingWorkflow.asl.json";

        OrdersWorkflow = new StateMachine(this, "InventoryOrderingWorkflow", new StateMachineProps()
        {
            StateMachineName = $"{props.SharedProps.ServiceName}-OrderWorkflow-{props.SharedProps.Env}",
            DefinitionBody = DefinitionBody.FromFile(workflowFilePath),
            DefinitionSubstitutions = new Dictionary<string, string>(1)
            {
                { "EventBusName", props.ServiceProps.PublisherBus.EventBusName },
                { "TableName", OrdersTable.TableName },
                { "Env", props.SharedProps.Env },
                { "ConfirmOrderLambda", confirmOrderHandler.FunctionArn },
                { "NoStockLambda", noStockHandler.FunctionArn }
            },
            Logs = new LogOptions()
            {
                Destination = workflowLogGroup,
                IncludeExecutionData = true,
                Level = LogLevel.ALL
            }
        });
        Tags.Of(OrdersWorkflow).Add("env", props.SharedProps.Env);
        Tags.Of(OrdersWorkflow).Add("service", props.SharedProps.ServiceName);
        Tags.Of(OrdersWorkflow).Add("version", props.SharedProps.Version);
        Tags.Of(OrdersWorkflow).Add("DD_TRACE_ENABLED", "true");
        Tags.Of(OrdersWorkflow).Add("DD_ENHANCED_METRICS", "true");
        
        props.ServiceProps.PublisherBus.GrantPutEventsTo(OrdersWorkflow);
        OrdersTable.GrantWriteData(OrdersWorkflow);
        confirmOrderHandler.GrantInvoke(OrdersWorkflow);
        noStockHandler.GrantInvoke(OrdersWorkflow);
    }

    public OrdersApi(Construct scope, string id, OrdersApiProps props) : base(scope, id)
    {
        var describeBusPolicyStatement = new PolicyStatement(new PolicyStatementProps()
        {
            Effect = Effect.ALLOW,
            Resources = new[] { props.ServiceProps.PublisherBus.EventBusArn },
            Actions = new[] { "events:DescribeEventBus" }
        });

        OrdersTable = new Table(this, "DotnetOrdersTable", new TableProps()
        {
            PartitionKey = new Attribute() { Name = "PK", Type = AttributeType.STRING },
            SortKey = new Attribute() { Name = "SK", Type = AttributeType.STRING },
            BillingMode = BillingMode.PAY_PER_REQUEST,
            TableName = $"{props.SharedProps.ServiceName}-OrderTable-{props.SharedProps.Env}",
            TableClass = TableClass.STANDARD,
            RemovalPolicy = RemovalPolicy.DESTROY,
        });
        OrdersTable.AddGlobalSecondaryIndex(new GlobalSecondaryIndexProps()
        {
            IndexName = "GSI1",
            PartitionKey = new Attribute() { Name = "GSI1PK", Type = AttributeType.STRING },
            SortKey = new Attribute() { Name = "GSI1SK", Type = AttributeType.STRING },
            ProjectionType = ProjectionType.ALL
        });

        OrderCreatedTopic = new Topic(this, "OrderCreatedTopic", new TopicProps()
        {
            TopicName = $"{props.SharedProps.ServiceName}-OrderCreated-{props.SharedProps.Env}"
        });

        CreateOrderWorkflow(props, describeBusPolicyStatement);

        CreateOrderAPI(props, describeBusPolicyStatement);
    }

    private IFunction CreateConfirmOrderHandler(OrdersApiProps props,
        Dictionary<string, string> environmentVariables)
    {
        var function = new InstrumentedFunction(this, "ConfirmOrderFunction",
            new FunctionProps(props.SharedProps, "ConfirmOrder", "../src/Orders.BackgroundWorkers/",
                "Orders.BackgroundWorkers::Orders.BackgroundWorkers.WorkflowHandlers_ReservationSuccess_Generated::ReservationSuccess",
                environmentVariables, props.SharedProps.DDApiKeySecret));

        OrdersTable.GrantReadWriteData(function.Function);
        props.ServiceProps.PublisherBus.GrantPutEventsTo(function.Function);
        
        return function.Function;
    }

    private IFunction CreateNoStockHandler(OrdersApiProps props, Dictionary<string, string> environmentVariables)
    {
        var function = new InstrumentedFunction(this, "NoStockFunction",
            new FunctionProps(props.SharedProps, "NoStock", "../src/Orders.BackgroundWorkers/",
                "Orders.BackgroundWorkers::Orders.BackgroundWorkers.WorkflowHandlers_ReservationFailed_Generated::ReservationFailed",
                environmentVariables, props.SharedProps.DDApiKeySecret));

        OrdersTable.GrantReadWriteData(function.Function);

        return function.Function;
    }

    private ApplicationLoadBalancedFargateService CreateOrderAPI(OrdersApiProps props,
        PolicyStatement describeBusPolicyStatement)
    {
        var vpc = new Vpc(this, "OrdersServiceVpc", new VpcProps()
        {
            VpcName = $"{props.SharedProps.ServiceName}-Orders-{props.SharedProps.Env}",
            MaxAzs = 2
        });

        var cluster = new Cluster(this, "DotnetInventoryApiCluster", new ClusterProps()
        {
            ClusterName = $"{props.SharedProps.ServiceName}-Orders-{props.SharedProps.Env}",
            Vpc = vpc
        });

        var executionRole = new Role(this, "OrdersApiExecutionRole", new RoleProps()
        {
            RoleName = $"CDK-{props.SharedProps.ServiceName}-Orders-{props.SharedProps.Env}-ExecutionRole",
            AssumedBy = new ServicePrincipal("ecs-tasks.amazonaws.com")
        });
        executionRole.AddManagedPolicy(
            ManagedPolicy.FromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"));

        var taskRole = new Role(this, "OrdersApiTaskRole", new RoleProps()
        {
            RoleName = $"CDK-{props.SharedProps.ServiceName}-Orders-{props.SharedProps.Env}-TaskRole",
            AssumedBy = new ServicePrincipal("ecs-tasks.amazonaws.com")
        });
        taskRole.AddManagedPolicy(
            ManagedPolicy.FromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"));
        

        var application = new ApplicationLoadBalancedFargateService(this, "OrdersService",
            new ApplicationLoadBalancedFargateServiceProps
            {
                Cluster = cluster,
                DesiredCount = 2,
                RuntimePlatform = new RuntimePlatform
                {
                    CpuArchitecture = CpuArchitecture.ARM64,
                    OperatingSystemFamily = OperatingSystemFamily.LINUX
                },
                TaskImageOptions = new ApplicationLoadBalancedTaskImageOptions
                {
                    Image = ContainerImage.FromRegistry(
                        "public.ecr.aws/k4y9x2e7/dd-serverless-sample-app-dotnet:latest"),
                    ExecutionRole = executionRole,
                    TaskRole = taskRole,
                    Environment = new Dictionary<string, string>
                    {
                        { "ORDER_CREATED_TOPIC_ARN", OrderCreatedTopic.TopicArn },
                        { "JWT_SECRET_PARAM_NAME", props.ServiceProps.JwtSecretAccessKey.ParameterName },
                        { "ORDER_WORKFLOW_ARN", OrdersWorkflow.StateMachineArn },
                        { "DD_LOGS_INJECTION", "true" },
                        { "TABLE_NAME", OrdersTable.TableName },
                        { "EVENT_BUS_NAME", props.ServiceProps.PublisherBus.EventBusName },
                        { "TEAM", props.SharedProps.Team },
                        { "DOMAIN", props.SharedProps.Domain },
                        { "ENV", props.SharedProps.Env },
                        { "DD_SERVICE", props.SharedProps.ServiceName },
                        { "DD_ENV", props.SharedProps.Env },
                        { "DD_VERSION", props.SharedProps.Version }
                    },
                    DockerLabels = new Dictionary<string, string>(3)
                    {
                        {"com.datadoghq.tags.env", props.SharedProps.Env },
                        {"com.datadoghq.tags.service", props.SharedProps.ServiceName },
                        {"com.datadoghq.tags.version", props.SharedProps.Version },
                    },
                    ContainerPort = 8080,
                    ContainerName = "DotnetInventoryApi",
                    LogDriver = LogDrivers.Firelens(new FireLensLogDriverProps()
                    {
                        Options = new Dictionary<string, string>
                        {
                            { "Name", "datadog" },
                            { "Host", $"http-intake.logs.{props.SharedProps.DDSite}" },
                            { "TLS", "on" },
                            { "dd_service", props.SharedProps.ServiceName },
                            { "dd_source", "expressjs" },
                            { "dd_message_key", "log" },
                            { "provider", "ecs" },
                            { "apikey", props.SharedProps.DDApiKeySecret.SecretValue.UnsafeUnwrap() }
                        }
                    })
                },
                MemoryLimitMiB = 512,
                PublicLoadBalancer = true
            });

        var allowHttpSecurityGroup = new SecurityGroup(this, "AllowHttpSecurityGroup", new SecurityGroupProps()
        {
            Vpc = vpc,
            SecurityGroupName = "AllowHttpSecurityGroup",
            AllowAllOutbound = true
        });
        allowHttpSecurityGroup.AddIngressRule(Peer.AnyIpv4(), Port.Tcp(80));
        application.LoadBalancer.AddSecurityGroup(allowHttpSecurityGroup);

        application.TaskDefinition.AddFirelensLogRouter("firelens", new FirelensLogRouterDefinitionOptions()
        {
            Essential = true,
            Image = ContainerImage.FromRegistry("amazon/aws-for-fluent-bit:stable"),
            ContainerName = "log-router",
            FirelensConfig = new FirelensConfig
            {
                Type = FirelensLogRouterType.FLUENTBIT,
                Options = new FirelensOptions()
                {
                    EnableECSLogMetadata = true
                }
            }
        });

        props.ServiceProps.JwtSecretAccessKey.GrantRead(taskRole);
        OrdersTable.GrantReadWriteData(taskRole);
        props.ServiceProps.PublisherBus.GrantPutEventsTo(taskRole);
        OrderCreatedTopic.GrantPublish(taskRole);
        OrdersWorkflow.GrantStartExecution(taskRole);

        taskRole.AddToPolicy(describeBusPolicyStatement);
        props.SharedProps.DDApiKeySecret.GrantRead(taskRole);
        props.SharedProps.DDApiKeySecret.GrantRead(executionRole);

        application.TargetGroup.ConfigureHealthCheck(new HealthCheck()
        {
            Port = "8080",
            Path = "/health",
            HealthyHttpCodes = "200-499",
            Timeout = Duration.Seconds(30),
            Interval = Duration.Seconds(60),
            UnhealthyThresholdCount = 5,
            HealthyThresholdCount = 2
        });

        application.TaskDefinition.AddContainer("Datadog", new ContainerDefinitionOptions
        {
            Image = ContainerImage.FromRegistry("public.ecr.aws/datadog/agent:latest"),
            PortMappings = new[]
            {
                new PortMapping { ContainerPort = 8125, HostPort = 8125 },
                new PortMapping { ContainerPort = 8126, HostPort = 8126 }
            },
            ContainerName = "datadog-agent",
            Environment = new Dictionary<string, string>
            {
                { "DD_SITE", props.SharedProps.DDSite },
                { "ECS_FARGATE", "true" },
                { "DD_LOGS_ENABLED", "false" },
                { "DD_PROCESS_AGENT_ENABLED", "true" },
                { "DD_APM_ENABLED", "true" },
                { "DD_APM_NON_LOCAL_TRAFFIC", "true" },
                { "DD_DOGSTATSD_NON_LOCAL_TRAFFIC", "true" },
                { "DD_ECS_TASK_COLLECTION_ENABLED", "true" },
                { "DD_ENV", props.SharedProps.Env },
                { "DD_SERVICE", props.SharedProps.ServiceName },
                { "DD_VERSION", props.SharedProps.Version },
                { "DD_APM_IGNORE_RESOURCES", "GET /health" }
            },
            Secrets = new Dictionary<string, Secret>
            {
                { "DD_API_KEY", Secret.FromSecretsManager(props.SharedProps.DDApiKeySecret) }
            }
        });

        // Add API Gateway endpoint to parameters
        new StringParameter(this, "ApiGatewayEndpoint", new StringParameterProps
        {
            ParameterName = $"/{props.SharedProps.Env}/{props.SharedProps.ServiceName}/api-endpoint",
            StringValue = $"http://{application.LoadBalancer.LoadBalancerDnsName}",
        });

        CreateApiGatewayForAlb(props, application);

        return application;
    }
    
    private IRestApi CreateApiGatewayForAlb(OrdersApiProps props, ApplicationLoadBalancedFargateService application)
    {
        var api = new RestApi(this, "OrdersApi", new RestApiProps
        {
            RestApiName = $"{props.SharedProps.ServiceName}-Orders-Api-{props.SharedProps.Env}",
            Description = "API Gateway for Orders Service",
            DeployOptions = new StageOptions
            {
                StageName = props.SharedProps.Env,
            },
            DefaultCorsPreflightOptions = new CorsOptions
            {
                AllowOrigins = Cors.ALL_ORIGINS,
                AllowMethods = Cors.ALL_METHODS,
                AllowHeaders = new[] { "Content-Type", "Authorization" }
            }
        });

        // Create integration with the ALB
        var albDnsName = application.LoadBalancer.LoadBalancerDnsName;
        var integration = new HttpIntegration($"http://{albDnsName}/{{proxy}}", new HttpIntegrationProps()
        {
            HttpMethod = "ANY",
            Proxy = true,
            Options = new IntegrationOptions
            {
                IntegrationResponses = new[]
                {
                    new IntegrationResponse
                    {
                        StatusCode = "200",
                        ResponseParameters = new Dictionary<string, string>
                        {
                            {
                                "method.response.header.Access-Control-Allow-Origin", "'*'"
                            }
                        }
                    }
                },
                RequestParameters = new Dictionary<string, string>
                {
                    {
                        "integration.request.path.proxy", "method.request.path.proxy"
                    }
                },
            },
        });

        // Proxy all requests to the ALB
        var proxyResource = api.Root.AddResource("{proxy+}");
        proxyResource.AddMethod("ANY", integration, new MethodOptions
        {
            RequestParameters = new Dictionary<string, bool>()
            {
                {"method.request.path.proxy", true} 
            },
            MethodResponses = new[] 
            {
                new MethodResponse
                {
                    StatusCode = "200",
                    ResponseParameters = new Dictionary<string, bool>
                    {
                        {"method.response.header.Access-Control-Allow-Origin", true}
                    },
                }
            }
        });

        // Also route the root path
        api.Root.AddMethod("ANY", integration, new MethodOptions
        {
            RequestParameters = new Dictionary<string, bool>()
            {
                {"method.request.path.proxy", true} 
            },
            MethodResponses = new[] 
            {
                new MethodResponse
                {
                    StatusCode = "200",
                    ResponseParameters = new Dictionary<string, bool>
                    {
                        {"method.response.header.Access-Control-Allow-Origin", true}
                    }
                }
            }
        });

        return api;
    }
}
