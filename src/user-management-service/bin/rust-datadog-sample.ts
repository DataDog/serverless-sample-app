#!/usr/bin/env node
import { App, Tags } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { UserManagementStack } from "../lib/user-management-api/user-management-stack";

const app = new App();

const apiStack = new UserManagementStack(app, "UserManagementApi", {
  stackName: `UserManagementApi-${process.env.ENV ?? "dev"}`,
});

cdk.Tags.of(apiStack).add("env", process.env.ENV ?? "dev");
cdk.Tags.of(apiStack).add("project", "serverless-sample-app");
cdk.Tags.of(apiStack).add("service", "user-service");
cdk.Tags.of(apiStack).add("team", "advocacy");
cdk.Tags.of(apiStack).add("primary-owner", "james@datadog.com");
