#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { OrderMcpStack } from "../lib/order-mcp/orderMcpStack";

const app = new cdk.App();

const orderMcpStack = new OrderMcpStack(app, "OrderMcpStack", {
    stackName: `OrderMcpService-${process.env.ENV ?? "dev"}`
});