#!/usr/bin/env node

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import fs from "fs/promises";
import path from "path";

async function updateConfig() {
  try {
    // Initialize SSM client
    const client = new SSMClient({ region: process.env.AWS_REGION });
    const env = process.env.ENV ?? "dev";

    const loyaltyApiEndpoint = await getParameterValue(
      client,
      `/${env}/LoyaltyService/api-endpoint`
    );
    const productApiEndpoint = await getParameterValue(
      client,
      `/${env}/ProductService/api-endpoint`
    );
    const userApiEndpoint = await getParameterValue(
      client,
      `/${env}/Users/api-endpoint`
    );
    // const pricingApiEndpoint = await getParameterValue(
    //   client,
    //   `/${env}/PricingService/api-endpoint`
    // );
    const orderApiEndpoint = await getParameterValue(
      client,
      `/${env}/OrdersService/api-endpoint`
    );
    const inventoryApiEndpoint = await getParameterValue(
      client,
      `/${env}/InventoryService/api-endpoint`
    );

    const envVars = [
      `export PRODUCT_API_ENDPOINT="${productApiEndpoint}"`,
      `export USER_API_ENDPOINT="${userApiEndpoint}"`,
      `export INVENTORY_API_ENDPOINT="${inventoryApiEndpoint}"`,
      `export ORDER_API_ENDPOINT="${orderApiEndpoint}"`,
      `export LOYALTY_API_ENDPOINT="${loyaltyApiEndpoint}"`,
    ].join("\n");

    console.log(envVars);
  } catch (error) {
    console.error("Error updating config:", error);
    process.exit(1);
  }
}

async function getParameterValue(client, parameterName) {
  const timeout = 10 * 60 * 1000; // 10 minutes in milliseconds
  const interval = 30 * 1000; // 30 seconds in milliseconds
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const getParameterCommand = {
        Name: parameterName,
        WithDecryption: true,
      };

      const command = new GetParameterCommand(getParameterCommand);
      const response = await client.send(command);
      return response.Parameter.Value.replace(/\/+$/, "");
    } catch (error) {
      if (Date.now() - startTime + interval >= timeout) {
        throw new Error(
          `Timeout reached while trying to fetch ${parameterName}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw new Error(
    `Failed to fetch parameter ${parameterName} after ${timeout / 1000} seconds`
  );
}

updateConfig();
