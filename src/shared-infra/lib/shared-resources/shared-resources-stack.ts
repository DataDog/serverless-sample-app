//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { EventBus } from "aws-cdk-lib/aws-events";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { randomUUID } from "crypto";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Bucket } from "aws-cdk-lib/aws-s3";

// no-dd-sa:typescript-best-practices/no-unnecessary-class
export class SharedResourcesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const env = process.env.ENV ?? "local";
    const ddApiKey = process.env.DD_API_KEY!;

    const sharedEventBus = new EventBus(this, "SharedEventBus", {
      eventBusName: `SharedEventBus-${env}`,
    });

    const frontendApplicationS3Bucket = new Bucket(
      this,
      "FrontendApplicationS3Bucket",
      {
        bucketName: `serverless-sample-frontend-app-${env}-${this.account}`,
        objectOwnership: cdk.aws_s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
        websiteIndexDocument: "index.html",
        websiteErrorDocument: "index.html",
      }
    );

    const sharedEventBusNameParameter = new StringParameter(
      this,
      "SharedEventBusName",
      {
        parameterName: `/${env}/shared/event-bus-name`,
        stringValue: sharedEventBus.eventBusName,
      }
    );
    const sharedEventBusArnParameter = new StringParameter(
      this,
      "SharedEventBusArn",
      {
        parameterName: `/${env}/shared/event-bus-arn`,
        stringValue: sharedEventBus.eventBusArn,
      }
    );

    const jwtSecretKeyParameter = new StringParameter(this, "JwtSecretKey", {
      parameterName: `/${env}/shared/secret-access-key`,
      stringValue: randomUUID().toString(),
    });

    const ddApiKeySecret = new Secret(this, "DDApiKeySecret", {
      secretName: `/${env}/shared/serverless-sample-dd-api-key`,
      secretStringValue: new cdk.SecretValue(ddApiKey),
    });
  }
}
