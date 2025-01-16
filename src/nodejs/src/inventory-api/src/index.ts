//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import "./tracer"; // must come before importing any instrumented module.
import express, {  } from "express";
import {
  getInventoryItemRoute,
  updateInventoryStockLevel,
} from "./adapters/routes";
import { DynamoDbInventoryItems } from "./adapters/dynamoDbInventoryItems";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventPublisher, InventoryItems } from "./core/inventory";
import { InMemoryInventoryItems } from "./adapters/inMemoryInventoryItems";
import { EventBridgeEventPublisher } from "./adapters/eventBridgeEventPublisher";
import { NoOpEventPublisher } from "./adapters/noOpEventPublisher";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";

const logger = require("./adapters/logger");
const expressWinston = require("express-winston");

const app = express();
const port = process.env.PORT || 3000;

const isProduction = process.env["NODE_ENV"] === "production";

const dynamoDbClient = new DynamoDBClient();
const ebClient = new EventBridgeClient();

const inventoryItems: InventoryItems = isProduction
  ? new DynamoDbInventoryItems(dynamoDbClient)
  : new InMemoryInventoryItems();

const publisher: EventPublisher = isProduction
  ? new EventBridgeEventPublisher(ebClient)
  : new NoOpEventPublisher();

app.use(express.json());
app.use(
  expressWinston.logger({
    winstonInstance: logger,
  })
);

app.use(
  expressWinston.errorLogger({
    winstonInstance: logger,
  })
);

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.post("/inventory", updateInventoryStockLevel(inventoryItems, publisher));
app.get("/inventory/:productId", getInventoryItemRoute(inventoryItems));

app.listen(port, () => {
  logger.info(`Server running at http://localhost:${port}`);
});
