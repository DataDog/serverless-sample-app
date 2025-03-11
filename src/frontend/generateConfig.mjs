#!/usr/bin/env node

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import fs from "fs/promises";
import path from "path";

async function updateConfig() {
  try {
    // Initialize SSM client
    const client = new SSMClient({ region: "us-east-1" });

    const loyaltyApiEndpoint = await getParameterValue(
      client,
      "/dev/LoyaltyService/api-endpoint"
    );
    const productApiEndpoint = await getParameterValue(
      client,
      "/dev/ProductManagementService/api-endpoint"
    );
    const userApiEndpoint = await getParameterValue(
      client,
      "/dev/UserManagementService/api-endpoint"
    );
    const pricingApiEndpoint = await getParameterValue(
      client,
      "/dev/PricingService/api-endpoint"
    );
    const orderApiEndpoint = await getParameterValue(
      client,
      "/dev/OrdersService/api-endpoint"
    );
    const inventoryApiEndpoint = await getParameterValue(
      client,
      "/dev/InventoryService/api-endpoint"
    );

    // Create config object
    const config = {
      PRODUCT_API_ENDPOINT: productApiEndpoint,
      USER_API_ENDPOINT: userApiEndpoint,
      INVENTORY_API_ENDPOINT: inventoryApiEndpoint,
      ORDER_API_ENDPOINT: orderApiEndpoint,
      LOYALTY_API_ENDPOINT: loyaltyApiEndpoint,
      PRICING_API_ENDPOINT: pricingApiEndpoint,
      DD_CLIENT_TOKEN: "pubaf7193b34bdb6ae82db1d81396376859",
      DD_APPLICATION_ID: "9603559d-897a-498f-b8e5-c3aa95dfe71f",
      DD_SITE: "datadoghq.eu",
    };

    // Convert config to string format
    const configContent = `export default ${JSON.stringify(config, null, 4)};`;

    // Write to config.js
    await fs.writeFile(path.resolve("./src/config.js"), configContent);

    console.log("Config file updated successfully");
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
      console.log(`Retrieving parameter: ${parameterName}`);

      const getParameterCommand = {
        Name: parameterName,
        WithDecryption: true,
      };

      const command = new GetParameterCommand(getParameterCommand);
      const response = await client.send(command);
      return response.Parameter.Value.replace(/\/+$/, "");
    } catch (error) {
      console.error(
        `Error fetching parameter ${parameterName}:`,
        error.message
      );

      if (Date.now() - startTime + interval >= timeout) {
        throw new Error(
          `Timeout reached while trying to fetch ${parameterName}`
        );
      }

      console.log(`Retrying in 30 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  throw new Error(
    `Failed to fetch parameter ${parameterName} after ${timeout / 1000} seconds`
  );
}

updateConfig();
