#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { OrderMcpStack } from "../lib/order-mcp/orderMcpStack";

const app = new cdk.App();

const orderMcpStack = new OrderMcpStack(app, "OrderMcpStack", {
    stackName: `OrderMcpService-${process.env.ENV ?? "dev"}`
});

cdk.Tags.of(orderMcpStack).add("env", process.env.ENV ?? "dev");
cdk.Tags.of(orderMcpStack).add("project", "serverless-sample-app");
cdk.Tags.of(orderMcpStack).add("service", "order-mcp");
cdk.Tags.of(orderMcpStack).add("team", "advocacy");
cdk.Tags.of(orderMcpStack).add("primary-owner", "james@datadog.com");