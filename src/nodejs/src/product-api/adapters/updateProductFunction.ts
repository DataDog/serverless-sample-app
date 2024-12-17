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
import {
  UpdateProductHandler,
  UpdateProductCommand,
} from "../core/update-product/updateProductHandler";
import { addDefaultServiceTagsTo } from "../../observability/observability";

const dynamoDbClient = new DynamoDBClient();
const snsClient = new SNSClient();

const updateProductHandler = new UpdateProductHandler(
  new DynamoDbProductRepository(dynamoDbClient),
  new SnsEventPublisher(snsClient)
);

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const span = tracer.scope().active();
  addDefaultServiceTagsTo(span);

  if (event.body === undefined) {
    return {
      statusCode: 400,
    };
  }

  const command: UpdateProductCommand = JSON.parse(event.body);

  const result = await updateProductHandler.handle(command);

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
