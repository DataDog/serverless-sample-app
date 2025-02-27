// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Amazon.CDK.AWS.SSM;
using Constructs;
using OrdersService.CDK.Constructs;
using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.EC2;
using Amazon.CDK.AWS.ECS;
using Amazon.CDK.AWS.ECS.Patterns;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.IAM;
using Amazon.CDK.AWS.Logs;
using Amazon.CDK.AWS.SNS;
using Amazon.CDK.AWS.StepFunctions;
using EventBus = Amazon.CDK.AWS.Events.Targets.EventBus;
using HealthCheck = Amazon.CDK.AWS.ElasticLoadBalancingV2.HealthCheck;

namespace OrdersService.CDK.Services.Orders.Service;

public record OrdersApiProps(
    SharedProps SharedProps,
    IStringParameter JwtSecretKeyParam,
    IEventBus OrdersServiceEventBus,
    IEventBus? SharedEventBus);

public class OrdersApi : Construct
{
    public ITopic OrderCreatedTopic { get; private set; }
    public ITable OrdersTable { get; private set; }
    public IStateMachine OrdersWorkflow { get; private set; }

    public OrdersApi(Construct scope, string id, OrdersApiProps props) : base(scope, id)
    {
        OrdersTable = new Table(this, "DotnetOrdersTable", new TableProps()
        {
            PartitionKey = new Attribute() { Name = "PK", Type = AttributeType.STRING },
            SortKey = new Attribute() { Name = "SK", Type = AttributeType.STRING },
            BillingMode = BillingMode.PAY_PER_REQUEST,
            TableName = $"{props.SharedProps.ServiceName}-OrderTable-{props.SharedProps.Env}",
            TableClass = TableClass.STANDARD,
            RemovalPolicy = RemovalPolicy.DESTROY
        });
        
        var vpc = new Vpc(this, "OrdersServiceVpc", new VpcProps()
        {
            VpcName = $"{props.SharedProps.ServiceName}-Orders-{props.SharedProps.Env}",
            MaxAzs = 2
        });
        
        LogGroup workflowLogGroup = new LogGroup(this, "InventoryOrderingWorkflowLogGroup", new LogGroupProps()
            {
               LogGroupName = $"/aws/vendedlogs/states/{props.SharedProps.ServiceName}-OrderWorkflow-{props.SharedProps.Env}",
               RemovalPolicy = RemovalPolicy.DESTROY
            });

        string workflowFilePath = "workflows/orderProcessingWorkflow.asl.json";

        OrdersWorkflow = new StateMachine(this, "InventoryOrderingWorkflow", new StateMachineProps()
        {
            StateMachineName = $"{props.SharedProps.ServiceName}-OrderWorkflow-{props.SharedProps.Env}",
            DefinitionBody = DefinitionBody.FromFile(workflowFilePath),
            DefinitionSubstitutions = new Dictionary<string, string>(1)
            {
                { "EventBusName", props.OrdersServiceEventBus.EventBusName },
                { "TableName", OrdersTable.TableName },
                { "Env", props.SharedProps.Env }
            },
            Logs = new LogOptions()
            {
                Destination = workflowLogGroup,
                IncludeExecutionData = true,
                Level = LogLevel.ALL
            }
        });
        props.OrdersServiceEventBus.GrantPutEventsTo(OrdersWorkflow);
        OrdersTable.GrantWriteData(OrdersWorkflow);

        var cluster = new Cluster(this, "DotnetInventoryApiCluster", new ClusterProps()
        {
            ClusterName = $"{props.SharedProps.ServiceName}-Orders-{props.SharedProps.Env}",
            Vpc = vpc
        });

        OrderCreatedTopic = new Topic(this, "OrderCreatedTopic", new TopicProps()
        {
            TopicName = $"{props.SharedProps.ServiceName}-OrderCreated-{props.SharedProps.Env}"
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
                        { "JWT_SECRET_PARAM_NAME", props.JwtSecretKeyParam.ParameterName },
                        { "ORDER_WORKFLOW_ARN", OrdersWorkflow.StateMachineArn},
                        { "TABLE_NAME", OrdersTable.TableName },
                        { "EVENT_BUS_NAME", props.OrdersServiceEventBus.EventBusName },
                        { "TEAM", "orders" },
                        { "DOMAIN", "orders" },
                        { "ENV", props.SharedProps.Env },
                        { "DD_SERVICE", props.SharedProps.ServiceName },
                        { "DD_ENV", props.SharedProps.Env },
                        { "DD_VERSION", props.SharedProps.Version }
                    },
                    ContainerPort = 8080,
                    ContainerName = "DotnetInventoryApi",
                    LogDriver = LogDrivers.Firelens(new FireLensLogDriverProps()
                    {
                        Options = new Dictionary<string, string>
                        {
                            { "Name", "datadog" },
                            { "Host", "http-intake.logs.datadoghq.eu" },
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

        props.JwtSecretKeyParam.GrantRead(taskRole);
        OrdersTable.GrantReadWriteData(taskRole);
        props.OrdersServiceEventBus.GrantPutEventsTo(taskRole);
        OrderCreatedTopic.GrantPublish(taskRole);
        OrdersWorkflow.GrantStartExecution(taskRole);
        
        taskRole.AddToPolicy(new PolicyStatement(new PolicyStatementProps()
        {
            Effect = Effect.ALLOW,
            Resources = new[] { props.OrdersServiceEventBus.EventBusArn },
            Actions = new[] { "events:DescribeEventBus" }
        }));
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
                { "DD_SITE", "datadoghq.eu" },
                { "ECS_FARGATE", "true" },
                { "DD_LOGS_ENABLED", "false" },
                { "DD_PROCESS_AGENT_ENABLED", "true" },
                { "DD_APM_ENABLED", "true" },
                { "DD_APM_NON_LOCAL_TRAFFIC", "true" },
                { "DD_DOGSTATSD_NON_LOCAL_TRAFFIC", "trueprops.SharedProps" },
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

        var apiEndpointParam = new StringParameter(this, "ApiEndpoint", new StringParameterProps()
        {
            ParameterName = $"/{props.SharedProps.Env}/{props.SharedProps.ServiceName}/api-endpoint",
            StringValue = $"http://{application.LoadBalancer.LoadBalancerDnsName}"
        });
    }
}