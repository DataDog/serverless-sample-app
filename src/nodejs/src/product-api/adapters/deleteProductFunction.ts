//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SNSClient } from "@aws-sdk/client-sns";
import { tracer } from "dd-trace";
import { DynamoDbProductRepository } from "./dynamoDbProductRepository";
import { SnsEventPublisher } from "./snsEventPublisher";
import { DeleteProductHandler } from "../core/delete-product/deleteProductHandler";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({ serviceName: process.env.DD_SERVICE });

const dynamoDbClient = new DynamoDBClient();
const snsClient = new SNSClient();

const deleteProductHandler = new DeleteProductHandler(
  new DynamoDbProductRepository(dynamoDbClient),
  new SnsEventPublisher(snsClient)
);

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  logger.info("Handling delete request");

  const productId = event.pathParameters!["productId"];

  if (productId === undefined) {
    logger.warn("ProductID not found in path, returning");
    return {
      statusCode: 400,
      body: "Must provide productId",
      headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST,GET,PUT,DELETE"
      }
    };
  }

  const result = await deleteProductHandler.handle({
    productId,
  });

  logger.info(`Result is ${result.data}`);

  return {
    statusCode: result.success ? 200 : 400,
    body: JSON.stringify(result),
    headers: {
      "Content-Type": "application-json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST,GET,PUT,DELETE"
    },
  };
};
