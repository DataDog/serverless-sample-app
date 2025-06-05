/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.inventory.api;

import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.services.apigateway.*;
import software.amazon.awscdk.services.dynamodb.*;
import software.amazon.awscdk.services.ec2.*;
import software.amazon.awscdk.services.ecs.*;
import software.amazon.awscdk.services.ecs.patterns.ApplicationLoadBalancedFargateService;
import software.amazon.awscdk.services.ecs.patterns.ApplicationLoadBalancedTaskImageOptions;
import software.amazon.awscdk.services.elasticloadbalancingv2.HealthCheck;
import software.amazon.awscdk.services.iam.*;
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

        Map<String, String> environmentVariables = new HashMap<>();
        environmentVariables.put("DD_LOGS_INJECTION", "true");
        environmentVariables.put("TABLE_NAME", table.getTableName());
        environmentVariables.put("EVENT_BUS_NAME", props.serviceProps().getPublisherEventBus().getEventBusName());
        environmentVariables.put("TEAM", "inventory");
        environmentVariables.put("DOMAIN", "inventory");
        environmentVariables.put("ENV", props.serviceProps().getSharedProps().env());
        environmentVariables.put("DD_SERVICE", props.serviceProps().getSharedProps().service());
        environmentVariables.put("DD_ENV", props.serviceProps().getSharedProps().env());
        environmentVariables.put("DD_VERSION", props.serviceProps().getSharedProps().version());
        environmentVariables.put("JWT_SECRET_PARAM_NAME", props.serviceProps().getJwtAccessKeyParameter().getParameterName());
        environmentVariables.put("QUARKUS_HTTP_CORS_HEADERS", "Accept,Authorization,Content-Type");
        environmentVariables.put("QUARKUS_HTTP_CORS_METHODS", "GET,POST,OPTIONS,PUT,DELETE");
        environmentVariables.put("QUARKUS_HTTP_CORS_ORIGINS", "*");
        environmentVariables.put("DD_DATA_STREAMS_ENABLED", "true");


        Map<String, String> dockerLabels = new HashMap<>();
        dockerLabels.put("com.datadoghq.tags.env", props.serviceProps().getSharedProps().env());
        dockerLabels.put("com.datadoghq.tags.service", props.serviceProps().getSharedProps().service());
        dockerLabels.put("com.datadoghq.tags.version", props.serviceProps().getSharedProps().version());

        ApplicationLoadBalancedFargateService application = ApplicationLoadBalancedFargateService.Builder.create(this, "InventoryApiService")
                .cluster(cluster)
                .desiredCount(2)
                .runtimePlatform(RuntimePlatform.builder()
                        .cpuArchitecture(CpuArchitecture.X86_64)
                        .operatingSystemFamily(OperatingSystemFamily.LINUX)
                        .build())
                .taskImageOptions(ApplicationLoadBalancedTaskImageOptions.builder()
                        .image(ContainerImage.fromRegistry(String.format(
                                                        "public.ecr.aws/k4y9x2e7/dd-serverless-sample-app-inventory-java:%s", props.serviceProps().getSharedProps().version())))
                        .executionRole(executionRole)
                        .taskRole(taskRole)
                        .environment(environmentVariables)
                        .containerPort(8080)
                        .containerName("InventoryApi")
                        .dockerLabels(Map.of(
                                "com.datadoghq.tags.env", props.serviceProps().getSharedProps().env(),
                                "com.datadoghq.tags.service", props.serviceProps().getSharedProps().service(),
                                "com.datadoghq.tags.version", props.serviceProps().getSharedProps().version()
                        ))
                        .logDriver(new FireLensLogDriver(FireLensLogDriverProps.builder()
                                .options(Map.of(
                                        "Name", "datadog",
                                        "Host", String.format("http-intake.logs.%s", props.serviceProps().getSharedProps().ddSite()),
                                        "TLS", "on",
                                        "dd_service", props.serviceProps().getSharedProps().service(),
                                        "dd_source", "expressjs",
                                        "dd_message_key", "log",
                                        "provider", "ecs",
                                        "apikey", props.serviceProps().getSharedProps().ddApiKeySecret().getSecretValue().unsafeUnwrap()
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
        props.serviceProps().getPublisherEventBus().grantPutEventsTo(taskRole);
        props.serviceProps().getJwtAccessKeyParameter().grantRead(taskRole);
        
        taskRole.addToPolicy(PolicyStatement.Builder.create()
                .effect(Effect.ALLOW)
                .resources(List.of("*"))
                .actions(List.of("events:ListEventBuses"))
                .build());
        props.serviceProps().getSharedProps().ddApiKeySecret().grantRead(taskRole);
        props.serviceProps().getSharedProps().ddApiKeySecret().grantRead(executionRole);

        application.getTargetGroup().configureHealthCheck(HealthCheck.builder()
                .port("8080")
                .path("/health")
                .healthyHttpCodes("200-499")
                .timeout(Duration.seconds(30))
                .interval(Duration.seconds(60))
                .unhealthyThresholdCount(5)
                .healthyThresholdCount(2)
                .build());
        
        String env  = props.serviceProps().getSharedProps().env();
        String service = props.serviceProps().getSharedProps().service();
        String version = props.serviceProps().getSharedProps().version();

        Map<String, String> datadogEnvironmentVariables = new HashMap<>();
        datadogEnvironmentVariables.put("DD_SITE", "datadoghq.eu");
        datadogEnvironmentVariables.put("ECS_FARGATE", "true");
        datadogEnvironmentVariables.put("DD_LOGS_ENABLED", "false");
        datadogEnvironmentVariables.put("DD_PROCESS_AGENT_ENABLED", "true");
        datadogEnvironmentVariables.put("DD_APM_ENABLED", "true");
        datadogEnvironmentVariables.put("DD_APM_NON_LOCAL_TRAFFIC", "true");
        datadogEnvironmentVariables.put("DD_DOGSTATSD_NON_LOCAL_TRAFFIC", "true");
        datadogEnvironmentVariables.put("DD_ECS_TASK_COLLECTION_ENABLED", "true");
        datadogEnvironmentVariables.put("DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_GRPC_ENDPOINT", "0.0.0.0:4317");
        datadogEnvironmentVariables.put("DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_HTTP_ENDPOINT", "0.0.0.0:4318");
        datadogEnvironmentVariables.put("DD_ENV", env);
        datadogEnvironmentVariables.put("DD_SERVICE", service);
        datadogEnvironmentVariables.put("DD_VERSION", version);
        datadogEnvironmentVariables.put("DD_APM_IGNORE_RESOURCES", "(GET) /health,(GET) /");
        datadogEnvironmentVariables.put("DD_DATA_STREAMS_ENABLED", "true");
        
        application.getTaskDefinition().addContainer("Datadog", ContainerDefinitionOptions.builder()
                .image(ContainerImage.fromRegistry("public.ecr.aws/datadog/agent:latest"))
                .portMappings(List.of(
                        PortMapping.builder().containerPort(8125).hostPort(8125).build(),
                        PortMapping.builder().containerPort(8126).hostPort(8126).build()
                ))
                .containerName("datadog-agent")
                .environment(datadogEnvironmentVariables)
                .secrets(Map.of(
                        "DD_API_KEY", Secret.fromSecretsManager(props.serviceProps().getSharedProps().ddApiKeySecret())
                ))
                .build());

        var restApi = createApiGatewayForAlb(props, application);

        StringParameter apiEndpoint = new StringParameter(this, "ApiEndpoint", StringParameterProps.builder()
                .parameterName(String.format("/%s/%s/api-endpoint", props.serviceProps().getSharedProps().env(), props.serviceProps().getSharedProps().service()))
                .stringValue(String.format("http://%s", application
                                        .getLoadBalancer()
                                        .getLoadBalancerDnsName()))
                .build());
        
    }

    private RestApi createApiGatewayForAlb(InventoryApiContainerProps props, ApplicationLoadBalancedFargateService application) {
        RestApi api = RestApi.Builder.create(this, "OrdersApi")
                .restApiName(String.format("%s-Orders-Api-%s", props.serviceProps().getSharedProps().service(), props.serviceProps().getSharedProps().env()))
                .description("API Gateway for Orders Service")
                .deployOptions(StageOptions.builder()
                        .stageName(props.serviceProps().getSharedProps().env())
                        .build())
                .defaultCorsPreflightOptions(CorsOptions.builder()
                        .allowOrigins(Cors.ALL_ORIGINS)
                        .allowMethods(Cors.ALL_METHODS)
                        .allowHeaders(List.of("Content-Type", "Authorization"))
                        .build())
                .build();

        // Create integration with the ALB
        String albDnsName = application.getLoadBalancer().getLoadBalancerDnsName();
        HttpIntegration integration = HttpIntegration.Builder.create(String.format("http://%s/{proxy}", albDnsName))
                .httpMethod("ANY")
                .proxy(true)
                .options(IntegrationOptions.builder()
                        .integrationResponses(List.of(IntegrationResponse.builder()
                                .statusCode("200")
                                .responseParameters(Map.of(
                                        "method.response.header.Access-Control-Allow-Origin", "'*'"
                                ))
                                .build()))
                        .requestParameters(Map.of(
                                "integration.request.path.proxy", "method.request.path.proxy"
                        ))
                        .build())
                .build();

        // Proxy all requests to the ALB
        IResource proxyResource = api.getRoot().addResource("{proxy+}");
        proxyResource.addMethod("ANY", integration, MethodOptions.builder()
                .requestParameters(Map.of(
                        "method.request.path.proxy", true
                ))
                .methodResponses(List.of(MethodResponse.builder()
                        .statusCode("200")
                        .responseParameters(Map.of(
                                "method.response.header.Access-Control-Allow-Origin", true
                        ))
                        .build()))
                .build());

        // Also route the root path
        api.getRoot().addMethod("ANY", integration, MethodOptions.builder()
                .requestParameters(Map.of(
                        "method.request.path.proxy", true
                ))
                .methodResponses(List.of(MethodResponse.builder()
                        .statusCode("200")
                        .responseParameters(Map.of(
                                "method.response.header.Access-Control-Allow-Origin", true
                        ))
                        .build()))
                .build());

        return api;
    }

    public ITable getTable(){
        return this.table;
    }
}
