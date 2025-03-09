//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import * as cdk from "aws-cdk-lib";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { Datadog } from "datadog-cdk-constructs-v2";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import {SharedProps} from "../constructs/sharedFunctionProps";
import {UserManagementApi} from "./api";
import {UserManagementBackgroundWorkers} from "./background-worker";
import {EventBus} from "aws-cdk-lib/aws-events";
import {Tags} from "aws-cdk-lib";

// no-dd-sa:typescript-best-practices/no-unnecessary-class
export class UserManagementStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const service = "UserMgmt";
    const env = process.env.ENV ?? "dev";
    const version = process.env["COMMIT_HASH"] ?? "latest";
    const team = "UserManagement";
    const domain = "UserManagement";

    const ddApiKey = new Secret(this, "DDApiKeySecret", {
      secretName: `/${env}/${service}/dd-api-key`,
      secretStringValue: new cdk.SecretValue(process.env.DD_API_KEY!),
    })

    const datadogConfiguration = new Datadog(this, "Datadog", {
      extensionLayerVersion: 73,
      site: process.env.DD_SITE ?? "datadoghq.com",
      apiKeySecret: ddApiKey,
      service,
      version,
      env,
      enableColdStartTracing: true,
      enableDatadogTracing: true,
      captureLambdaPayload: true,
    });
    
    Tags.of(this).add("service", service);
    Tags.of(this).add("env", version);
    Tags.of(this).add("team", team);
    Tags.of(this).add("domain", domain);

    const sharedProps: SharedProps = {
      environment: env,
      serviceName: service,
      version,
      datadogConfiguration,
        team,
        domain,
    };
    
    const jwtSecretKeyParameter = StringParameter.fromStringParameterName(this,  'JwtSecretKeyParameter', `/${env}/shared/secret-access-key`);
    const eventBusNameParameter = StringParameter.fromStringParameterName(this,  'EventBusNameParameter', `/${env}/shared/event-bus-name`);
    const eventBus = EventBus.fromEventBusName(this, 'EventBus', eventBusNameParameter.stringValue);

    const api = new UserManagementApi(this, "UserManagementApi", {
      sharedProps,
      ddApiKeySecret: ddApiKey,
        jwtSecretKeyParameter,
      sharedEventBus: eventBus
    });
    
    const backgroundWorker = new UserManagementBackgroundWorkers(this, "UserManagementBackgroundWorkers", {
      sharedProps,
      ddApiKeySecret: ddApiKey,
      userManagementTable: api.table,
      sharedEventBus: eventBus,
    });
    
    const apiEndpointParameter = new StringParameter(
      this,
      "UserManagementApiEndpointParameter",
      {
        parameterName: `/${sharedProps.environment}/UserManagementService/api-endpoint`,
        stringValue: api.api.url,
      }
    );
  }
}
