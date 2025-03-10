#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LoyaltyApiStack } from "../lib/loyalty-api/loyaltyApiStack";

const app = new cdk.App();

const loyaltyStack = new LoyaltyApiStack(app, "LoyaltyApiStack", {
    stackName: `LoyaltyService-${process.env.ENV ?? "dev"}`
});