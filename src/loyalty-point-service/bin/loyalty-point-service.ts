#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LoyaltyApiStack } from "../lib/loyalty-api/loyaltyApiStack";

const app = new cdk.App();

const loyaltyStack = new LoyaltyApiStack(app, "LoyaltyApiStack", {
    stackName: `LoyaltyService-${process.env.ENV ?? "dev"}`
});

cdk.Tags.of(loyaltyStack).add("env", process.env.ENV ?? "dev");
cdk.Tags.of(loyaltyStack).add("project", "serverless-sample-app");
cdk.Tags.of(loyaltyStack).add("service", "loyalty-point-service");
cdk.Tags.of(loyaltyStack).add("team", "advocacy");
cdk.Tags.of(loyaltyStack).add("primary-owner", "james@datadog.com");