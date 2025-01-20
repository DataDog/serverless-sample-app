// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.EC2;
using Amazon.CDK.AWS.ECS;
using Amazon.CDK.AWS.ECS.Patterns;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.IAM;
using Amazon.CDK.AWS.SSM;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;
using HealthCheck = Amazon.CDK.AWS.ElasticLoadBalancingV2.HealthCheck;
using Secret = Amazon.CDK.AWS.SecretsManager.Secret;

namespace ServerlessGettingStarted.CDK.Services.Inventory.Api;

public class InventoryApiStack : Stack
{
    internal InventoryApiStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
    {
        var secret = Secret.FromSecretCompleteArn(this, "DatadogApiKeySecret",
            System.Environment.GetEnvironmentVariable("DD_API_KEY_SECRET_ARN"));

        var serviceName = "DotnetInventoryAcl";
        var env = System.Environment.GetEnvironmentVariable("ENV") ?? "dev";
        var version = System.Environment.GetEnvironmentVariable("VERSION") ?? "latest";
        var sharedProps = new SharedProps(serviceName, env, version);

        var eventBusTopicArn = StringParameter.FromStringParameterName(this, "EventBusTopicArn",
            "/dotnet/shared/event-bus-name");
        var eventBus = EventBus.FromEventBusName(this, "SharedEventBus", eventBusTopicArn.StringValue);

        var vpc = new Vpc(this, "DotnetInventoryApiVpc", new VpcProps()
        {
            MaxAzs = 2
        });

        var cluster = new Cluster(this, "DotnetInventoryApiCluster", new ClusterProps()
        {
            Vpc = vpc
        });

        var table = new Table(this, "DotnetInventoryApiTable", new TableProps()
        {
            PartitionKey = new Attribute() { Name = "PK", Type = AttributeType.STRING },
            BillingMode = BillingMode.PAY_PER_REQUEST,
            TableName = $"DotnetInventoryItems-{env}",
            TableClass = TableClass.STANDARD,
            RemovalPolicy = RemovalPolicy.DESTROY
        });

        var inventoryTableNameParameter = new StringParameter(this, "DotnetInventoryApiTableName",
            new StringParameterProps()
            {
                ParameterName = $"/dotnet/{env}/inventory-api/table-name",
                StringValue = table.TableName
            });

        var executionRole = new Role(this, "DotnetInventoryApiExecutionRole", new RoleProps()
        {
            AssumedBy = new ServicePrincipal("ecs-tasks.amazonaws.com")
        });
        executionRole.AddManagedPolicy(
            ManagedPolicy.FromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"));

        var application = new ApplicationLoadBalancedFargateService(this, "DotnetInventoryApiService",
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
                    Image = ContainerImage.FromRegistry("public.ecr.aws/k4y9x2e7/dd-serverless-sample-app-dotnet:latest"),
                    ExecutionRole = executionRole,
                    Environment = new Dictionary<string, string>
                    {
                        { "TABLE_NAME", table.TableName },
                        { "EVENT_BUS_NAME", eventBus.EventBusName },
                        { "TEAM", "inventory" },
                        { "DOMAIN", "inventory" },
                        { "ENV", env }
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
                            { "dd_service", serviceName },
                            { "dd_source", "expressjs" },
                            { "dd_message_key", "log" },
                            { "provider", "ecs" },
                            { "apikey", secret.SecretValue.UnsafeUnwrap() }
                        }
                    })
                },
                MemoryLimitMiB = 512,
                PublicLoadBalancer = true
            });
        
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
        
        table.GrantReadWriteData(application.TaskDefinition.TaskRole);
        eventBus.GrantPutEventsTo(application.TaskDefinition.TaskRole);
        secret.GrantRead(application.TaskDefinition.TaskRole);
        secret.GrantRead(executionRole);
        
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
                { "DD_DOGSTATSD_NON_LOCAL_TRAFFIC", "true" },
                { "DD_ECS_TASK_COLLECTION_ENABLED", "true" },
                { "DD_ENV", env },
                { "DD_SERVICE", serviceName },
                { "DD_VERSION", version },
                { "DD_APM_IGNORE_RESOURCES", "GET /health" }
            },
            Secrets = new Dictionary<string, Amazon.CDK.AWS.ECS.Secret>
            {
                { "DD_API_KEY", Amazon.CDK.AWS.ECS.Secret.FromSecretsManager(secret) }
            }
        });
    }
}