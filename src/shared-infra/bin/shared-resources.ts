#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { SharedResourcesStack } from "../lib/shared-resources/shared-resources-stack";

const app = new cdk.App();

const sharedStack = new SharedResourcesStack(app, "SharedResourcesStack", {
  stackName: `SharedResourcesStack-${process.env.ENV ?? "dev"}`,
});
