/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.product.api.container;

import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.CfnOutputProps;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.services.dynamodb.*;
import software.amazon.awscdk.services.ec2.Vpc;
import software.amazon.awscdk.services.ecs.*;
import software.amazon.awscdk.services.elasticloadbalancingv2.HealthCheck;
import software.amazon.awscdk.services.ecs.patterns.ApplicationLoadBalancedFargateService;
import software.amazon.awscdk.services.ecs.patterns.ApplicationLoadBalancedTaskImageOptions;
import software.amazon.awscdk.services.events.EventBus;
import software.amazon.awscdk.services.events.IEventBus;
import software.amazon.awscdk.services.iam.*;
import software.amazon.awscdk.services.sns.ITopic;
import software.amazon.awscdk.services.sns.Topic;
import software.amazon.awscdk.services.sns.TopicProps;
import software.amazon.awscdk.services.ssm.IStringParameter;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.amazon.awscdk.services.ssm.StringParameterProps;
import software.constructs.Construct;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ProductApiContainer extends Construct {
    private final ITable table;
    
    public ProductApiContainer(@NotNull Construct scope, @NotNull String id, @NotNull ProductApiContainerProps props) {
        super(scope, id);
        Vpc vpc = Vpc.Builder.create(this, "JavaInventoryApiVpc")
                .maxAzs(2)
                .build();

        Cluster cluster = Cluster.Builder.create(this, "JavaInventoryApiCluster")
                .vpc(vpc)
                .build();

        this.table = new Table(this, "TracedJavaTable", TableProps.builder()
                .billingMode(BillingMode.PAY_PER_REQUEST)
                .tableClass(TableClass.STANDARD)
                .partitionKey(Attribute.builder()
                        .name("PK")
                        .type(AttributeType.STRING)
                        .build())
                .removalPolicy(RemovalPolicy.DESTROY)
                .build());

        ITopic productCreatedTopic = new Topic(this, "JavaProductCreatedTopic", TopicProps.builder()
                .topicName(String.format("ProductCreated-%s", props.sharedProps().env()))
                .build());
        ITopic productUpdatedTopic = new Topic(this, "JavaProductUpdatedTopic", TopicProps.builder()
                .topicName(String.format("ProductUpdated-%s", props.sharedProps().env()))
                .build());
        ITopic productDeletedTopic = new Topic(this, "JavaProductDeletedTopic", TopicProps.builder()
                .topicName(String.format("ProductDeleted-%s", props.sharedProps().env()))
                .build());

        Role executionRole = Role.Builder.create(this, "JavaInventoryApiExecutionRole")
                .assumedBy(new ServicePrincipal("ecs-tasks.amazonaws.com"))
                .build();
        executionRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"));

        Role taskRole = Role.Builder.create(this, "JavaInventoryApiTask")
                .assumedBy(new ServicePrincipal("ecs-tasks.amazonaws.com"))
                .build();
        taskRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"));

        ApplicationLoadBalancedFargateService application = ApplicationLoadBalancedFargateService.Builder.create(this, "JavaInventoryApiService")
                .cluster(cluster)
                .desiredCount(2)
                .runtimePlatform(RuntimePlatform.builder()
                        .cpuArchitecture(CpuArchitecture.ARM64)
                        .operatingSystemFamily(OperatingSystemFamily.LINUX)
                        .build())
                .taskImageOptions(ApplicationLoadBalancedTaskImageOptions.builder()
                        .image(ContainerImage.fromRegistry("public.ecr.aws/k4y9x2e7/dd-serverless-sample-app-java:latest"))
                        .executionRole(executionRole)
                        .taskRole(taskRole)
                        .environment(Map.of(
                                "TABLE_NAME", table.getTableName(),
                                "PRODUCT_CREATED_TOPIC_ARN", productCreatedTopic.getTopicArn(),
                                "PRODUCT_UPDATED_TOPIC_ARN", productUpdatedTopic.getTopicArn(),
                                "PRODUCT_DELETED_TOPIC_ARN", productDeletedTopic.getTopicArn(),
                                "TEAM", "inventory",
                                "DOMAIN", "inventory",
                                "ENV", props.sharedProps().env()
                        ))
                        .containerPort(8080)
                        .containerName("JavaInventoryApi")
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
        productCreatedTopic.grantPublish(taskRole);
        productUpdatedTopic.grantPublish(taskRole);
        productDeletedTopic.grantPublish(taskRole);
        
        taskRole.addToPolicy(PolicyStatement.Builder.create()
                .effect(Effect.ALLOW)
                .resources(List.of("*"))
                .actions(List.of("sns:ListTopics"))
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
                        "DD_API_KEY", software.amazon.awscdk.services.ecs.Secret.fromSecretsManager(props.sharedProps().ddApiKeySecret())
                ))
                .build());

        StringParameter productCreatedTopicArnParam = new StringParameter(this, "ProductCreatedTopicArn", StringParameterProps.builder()
                .parameterName("/java/product-api/product-created-topic")
                .stringValue(productCreatedTopic.getTopicArn())
                .build());
        StringParameter productCreatedTopicNameParam = new StringParameter(this, "ProductCreatedTopicName", StringParameterProps.builder()
                .parameterName("/java/product-api/product-created-topic-name")
                .stringValue(productCreatedTopic.getTopicName())
                .build());

        StringParameter productUpdatedTopicArnParam = new StringParameter(this, "ProductUpdatedTopicArn", StringParameterProps.builder()
                .parameterName("/java/product-api/product-updated-topic")
                .stringValue(productUpdatedTopic.getTopicArn())
                .build());
        StringParameter productUpdatedTopicNameParam = new StringParameter(this, "ProductUpdatedTopicName", StringParameterProps.builder()
                .parameterName("/java/product-api/product-updated-topic-name")
                .stringValue(productUpdatedTopic.getTopicName())
                .build());

        StringParameter productDeletedTopicArnParam = new StringParameter(this, "ProductDeletedTopicArn", StringParameterProps.builder()
                .parameterName("/java/product-api/product-deleted-topic")
                .stringValue(productDeletedTopic.getTopicArn())
                .build());
        StringParameter productDeletedTopicNameParam = new StringParameter(this, "ProductDeletedTopicName", StringParameterProps.builder()
                .parameterName("/java/product-api/product-deleted-topic-name")
                .stringValue(productDeletedTopic.getTopicName())
                .build());
        StringParameter tableNameParameter = new StringParameter(this, "TableNameParameter", StringParameterProps.builder()
                .parameterName("/java/product-api/table-name")
                .stringValue(this.table.getTableName())
                .build());
        StringParameter apiEndpoint = new StringParameter(this, "ApiEndpoint", StringParameterProps.builder()
                .parameterName(String.format("/java/%s/product/api-endpoint", props.sharedProps().env()))
                .stringValue(String.format("http://%s", application.getLoadBalancer().getLoadBalancerDnsName()))
                .build());

        var apiEndpointOutput = new CfnOutput(this, "JavaApiUrlOutput", CfnOutputProps.builder()
                .value(application.getLoadBalancer().getLoadBalancerDnsName())
                .exportName("ApiEndpoint")
                .build());
        
    }

    public ITable getTable(){
        return this.table;
    }
}
