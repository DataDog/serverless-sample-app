/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.inventory.api;

import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.CfnOutputProps;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.services.dynamodb.*;
import software.amazon.awscdk.services.ec2.*;
import software.amazon.awscdk.services.ecs.*;
import software.amazon.awscdk.services.ecs.patterns.ApplicationLoadBalancedFargateService;
import software.amazon.awscdk.services.ecs.patterns.ApplicationLoadBalancedTaskImageOptions;
import software.amazon.awscdk.services.elasticloadbalancingv2.HealthCheck;
import software.amazon.awscdk.services.iam.*;
import software.amazon.awscdk.services.sns.ITopic;
import software.amazon.awscdk.services.sns.Topic;
import software.amazon.awscdk.services.sns.TopicProps;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.amazon.awscdk.services.ssm.StringParameterProps;
import software.constructs.Construct;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class InventoryApiContainer extends Construct {
    private final ITable table;
    
    public InventoryApiContainer(@NotNull Construct scope, @NotNull String id, @NotNull InventoryApiContainerProps props) {
        super(scope, id);
        Vpc vpc = Vpc.Builder.create(this, "InventoryApiVpc")
                .maxAzs(2)
                .build();

        Cluster cluster = Cluster.Builder.create(this, "InventoryApiCluster")
                .vpc(vpc)
                .build();

        this.table = new Table(this, "TracedInventoryItems", TableProps.builder()
                .billingMode(BillingMode.PAY_PER_REQUEST)
                .tableClass(TableClass.STANDARD)
                .partitionKey(Attribute.builder()
                        .name("PK")
                        .type(AttributeType.STRING)
                        .build())
                .removalPolicy(RemovalPolicy.DESTROY)
                .build());

        Role executionRole = Role.Builder.create(this, "InventoryApiExecutionRole")
                .assumedBy(new ServicePrincipal("ecs-tasks.amazonaws.com"))
                .build();
        executionRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"));

        Role taskRole = Role.Builder.create(this, "InventoryApiTask")
                .assumedBy(new ServicePrincipal("ecs-tasks.amazonaws.com"))
                .build();
        taskRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"));

        ApplicationLoadBalancedFargateService application = ApplicationLoadBalancedFargateService.Builder.create(this, "InventoryApiService")
                .cluster(cluster)
                .desiredCount(1)
                .runtimePlatform(RuntimePlatform.builder()
                        .cpuArchitecture(CpuArchitecture.ARM64)
                        .operatingSystemFamily(OperatingSystemFamily.LINUX)
                        .build())
                .taskImageOptions(ApplicationLoadBalancedTaskImageOptions.builder()
                        .image(ContainerImage.fromRegistry("public.ecr.aws/k4y9x2e7/dd-serverless-sample-app-inventory-java:latest"))
                        .executionRole(executionRole)
                        .taskRole(taskRole)
                        .environment(Map.of(
                                "DD_LOGS_INJECTION", "true",
                                "TABLE_NAME", table.getTableName(),
                                "EVENT_BUS_NAME", props.sharedEventBus().getEventBusName(),
                                "TEAM", "inventory",
                                "DOMAIN", "inventory",
                                "ENV", props.sharedProps().env(),
                                "DD_SERVICE", props.sharedProps().service(),
                                "DD_ENV", props.sharedProps().env(),
                                "DD_VERSION", props.sharedProps().version(),
                                "JWT_SECRET_PARAM_NAME", props.jwtAccessKeyParameter().getParameterName()
                        ))
                        .containerPort(8080)
                        .containerName("InventoryApi")
                        .logDriver(new FireLensLogDriver(FireLensLogDriverProps.builder()
                                .options(Map.of(
                                        "Name", "datadog",
                                        "Host", "http-intake.logs.datadoghq.eu",
                                        "TLS", "on",
                                        "dd_service", props.sharedProps().service(),
                                        "dd_source", "expressjs",
                                        "dd_message_key", "log",
                                        "provider", "ecs",
                                        "apikey", props.sharedProps().ddApiKeySecret().getSecretValue().unsafeUnwrap()
                                ))
                                .build()))
                        .build())
                .memoryLimitMiB(512)
                .publicLoadBalancer(true)
                .build();

        var allowHttpSecurityGroup = new SecurityGroup(this, "AllowHttpSecurityGroup", SecurityGroupProps.builder()
                .vpc(vpc)
                .allowAllOutbound(true)
                .build());
        allowHttpSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80));

        application.getLoadBalancer().addSecurityGroup(allowHttpSecurityGroup);

        application.getTaskDefinition().addFirelensLogRouter("firelens", FirelensLogRouterDefinitionOptions.builder()
                .essential(true)
                .image(ContainerImage.fromRegistry("amazon/aws-for-fluent-bit:stable"))
                .containerName("log-router")
                .firelensConfig(FirelensConfig.builder()
                        .type(FirelensLogRouterType.FLUENTBIT)
                        .options(FirelensOptions.builder()
                                .enableEcsLogMetadata(true)
                                .build())
                        .build())
                .build());

        table.grantReadWriteData(taskRole);
        props.sharedEventBus().grantPutEventsTo(taskRole);
        props.jwtAccessKeyParameter().grantRead(taskRole);
        
        taskRole.addToPolicy(PolicyStatement.Builder.create()
                .effect(Effect.ALLOW)
                .resources(List.of("*"))
                .actions(List.of("events:ListEventBuses"))
                .build());
        props.sharedProps().ddApiKeySecret().grantRead(taskRole);
        props.sharedProps().ddApiKeySecret().grantRead(executionRole);

        application.getTargetGroup().configureHealthCheck(HealthCheck.builder()
                .port("8080")
                .path("/health")
                .healthyHttpCodes("200-499")
                .timeout(Duration.seconds(30))
                .interval(Duration.seconds(60))
                .unhealthyThresholdCount(5)
                .healthyThresholdCount(2)
                .build());
        
        String env  = props.sharedProps().env();
        String service = props.sharedProps().service();
        String version = props.sharedProps().version();

        Map<String, String> datadogEnvironmentVariables = new HashMap<>();
        datadogEnvironmentVariables.put("DD_SITE", "datadoghq.eu");
        datadogEnvironmentVariables.put("ECS_FARGATE", "true");
        datadogEnvironmentVariables.put("DD_LOGS_ENABLED", "false");
        datadogEnvironmentVariables.put("DD_PROCESS_AGENT_ENABLED", "true");
        datadogEnvironmentVariables.put("DD_APM_ENABLED", "true");
        datadogEnvironmentVariables.put("DD_APM_NON_LOCAL_TRAFFIC", "true");
        datadogEnvironmentVariables.put("DD_DOGSTATSD_NON_LOCAL_TRAFFIC", "true");
        datadogEnvironmentVariables.put("DD_ECS_TASK_COLLECTION_ENABLED", "true");
        datadogEnvironmentVariables.put("DD_APM_IGNORE_RESOURCES", "GET /");
        datadogEnvironmentVariables.put("DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_GRPC_ENDPOINT", "0.0.0.0:4317");
        datadogEnvironmentVariables.put("DD_ENV", env);
        datadogEnvironmentVariables.put("DD_SERVICE", service);
        datadogEnvironmentVariables.put("DD_VERSION", version);
        
        application.getTaskDefinition().addContainer("Datadog", ContainerDefinitionOptions.builder()
                .image(ContainerImage.fromRegistry("public.ecr.aws/datadog/agent:latest"))
                .portMappings(List.of(
                        PortMapping.builder().containerPort(8125).hostPort(8125).build(),
                        PortMapping.builder().containerPort(8126).hostPort(8126).build()
                ))
                .containerName("datadog-agent")
                .environment(datadogEnvironmentVariables)
                .secrets(Map.of(
                        "DD_API_KEY", Secret.fromSecretsManager(props.sharedProps().ddApiKeySecret())
                ))
                .build());

        StringParameter apiEndpoint = new StringParameter(this, "ApiEndpoint", StringParameterProps.builder()
                .parameterName(String.format("/%s/%s/api-endpoint", props.sharedProps().env(), props.sharedProps().service()))
                .stringValue(String.format("http://%s", application.getLoadBalancer().getLoadBalancerDnsName()))
                .build());

        var apiEndpointOutput = new CfnOutput(this, "InventoryApiUrlOutput", CfnOutputProps.builder()
                .value(application.getLoadBalancer().getLoadBalancerDnsName())
                .exportName("InventoryApiEndpoint")
                .build());
        
    }

    public ITable getTable(){
        return this.table;
    }
}
