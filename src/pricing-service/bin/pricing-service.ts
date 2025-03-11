#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { PricingApiStack } from "../lib/pricing-api/pricingApiStack";

const app = new cdk.App();

const loyaltyStack = new PricingApiStack(app, "PricingApiStack", {
  stackName: `PricingService-${process.env.ENV ?? "dev"}`,
});
