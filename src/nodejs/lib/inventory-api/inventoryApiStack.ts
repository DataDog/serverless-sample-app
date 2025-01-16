//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import {
  Cluster,
  ContainerImage,
  CpuArchitecture,
  FirelensLogRouterType,
  LogDrivers,
  OperatingSystemFamily,
} from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import {
  AttributeType,
  BillingMode,
  Table,
  TableClass,
} from "aws-cdk-lib/aws-dynamodb";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Topic } from "aws-cdk-lib/aws-sns";
import { EventBus } from "aws-cdk-lib/aws-events";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

// no-dd-sa:typescript-best-practices/no-unnecessary-class
export class InventoryApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ddApiKey = Secret.fromSecretCompleteArn(
      this,
      "DDApiKeySecret",
      process.env.DD_API_KEY_SECRET_ARN!
    );

    const service = "NodeInventoryApi";
    const env = process.env.ENV ?? "dev";
    const version = process.env["COMMIT_HASH"] ?? "latest";

    const sharedEventBus = EventBus.fromEventBusName(
      this,
      "SharedEventBus",
      "NodeTracingEventBus"
    );

    const vpc = new Vpc(this, "NodeInventoryApiVpc", {
      maxAzs: 2,
    });

    const cluster = new Cluster(this, "NodeInventoryApiCluster", {
      vpc,
    });

    const table = new Table(this, "NodeInventoryApiTable", {
      tableName: `NodeInventoryApi-${env}`,
      tableClass: TableClass.STANDARD,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const inventoryTableNameParameter = new StringParameter(
      this,
      "NodeInventoryApiTableNameParameter",
      {
        parameterName: `/node/${env}/inventory-api/table-name`,
        stringValue: table.tableName,
      }
    );

    const application = new ApplicationLoadBalancedFargateService(
      this,
      "NodeInventoryApiService",
      {
        cluster,
        desiredCount: 2,
        runtimePlatform: {
          cpuArchitecture: CpuArchitecture.ARM64,
          operatingSystemFamily: OperatingSystemFamily.LINUX,
        },
        taskImageOptions: {
          image: ContainerImage.fromRegistry(
            "public.ecr.aws/k4y9x2e7/dd-serverless-sample-app:latest"
          ),
          environment: {
            TABLE_NAME: table.tableName,
            EVENT_BUS_NAME: sharedEventBus.eventBusName,
            TEAM: "inventory",
            DOMAIN: "inventory",
            ENV: env,
          },
          containerPort: 3000,
          containerName: "NodeInventoryApi",
          logDriver: LogDrivers.firelens({
            options: {
              Name: "datadog",
              Host: "http-intake.logs.datadoghq.eu",
              TLS: "on",
              dd_service: service,
              dd_source: "expressjs",
              dd_message_key: "log",
              provider: "ecs",
              apikey: ddApiKey.secretValue.toString(),
            },
          }),
        },
        memoryLimitMiB: 512,
        publicLoadBalancer: true,
      }
    );

    application.taskDefinition.addFirelensLogRouter("firelens", {
      essential: true,
      image: ContainerImage.fromRegistry("amazon/aws-for-fluent-bit:stable"),
      containerName: "log-router",
      firelensConfig: {
        type: FirelensLogRouterType.FLUENTBIT,
        options: {
          enableECSLogMetadata: true,
        },
      },
    });

    table.grantReadWriteData(application.taskDefinition.taskRole);
    sharedEventBus.grantPutEventsTo(application.taskDefinition.taskRole);
    ddApiKey.grantRead(application.taskDefinition.taskRole);
    ddApiKey.grantRead(application.taskDefinition.executionRole!);

    application.targetGroup.healthCheck = {
      port: "3000",
      path: "/health",
      healthyHttpCodes: "200-499",
      timeout: cdk.Duration.seconds(30),
      interval: cdk.Duration.seconds(60),
      unhealthyThresholdCount: 5,
      healthyThresholdCount: 2,
    };

    application.taskDefinition.addContainer("Datadog", {
      image: ContainerImage.fromRegistry("public.ecr.aws/datadog/agent:latest"),
      portMappings: [
        { containerPort: 8125, hostPort: 8125 },
        { containerPort: 8126, hostPort: 8126 },
      ],
      containerName: "datadog-agent",
      environment: {
        DD_SITE: "datadoghq.eu",
        ECS_FARGATE: "true",
        DD_LOGS_ENABLED: "false",
        DD_PROCESS_AGENT_ENABLED: "true",
        DD_APM_ENABLED: "true",
        DD_APM_NON_LOCAL_TRAFFIC: "true",
        DD_DOGSTATSD_NON_LOCAL_TRAFFIC: "true",
        DD_ECS_TASK_COLLECTION_ENABLED: "true",
        DD_ENV: env,
        DD_SERVICE: service,
        DD_VERSION: version,
        DD_API_KEY: process.env.DD_API_KEY!,
        DD_APM_IGNORE_RESOURCES: "GET /health",
      },
      secrets: {
        DD_API_KEY: cdk.aws_ecs.Secret.fromSecretsManager(ddApiKey),
      },
    });
  }
}
