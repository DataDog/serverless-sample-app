#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PricingApiStack } from "../lib/pricing-api/pricingApiStack";

const app = new cdk.App();

const pricingStack = new PricingApiStack(app, "PricingApiStack", {
  stackName: `PricingService-${process.env.ENV ?? "dev"}`,
});

cdk.Tags.of(pricingStack).add("env", process.env.ENV ?? "dev");
cdk.Tags.of(pricingStack).add("project", "serverless-sample-app");
cdk.Tags.of(pricingStack).add("service", "pricing-service");
cdk.Tags.of(pricingStack).add("team", "advocacy");
cdk.Tags.of(pricingStack).add("primary-owner", "james@datadog.com");
