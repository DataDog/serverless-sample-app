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
import {
  CreateProductCommand,
  CreateProductHandler,
} from "../core/create-product/createProductHandler";
import { DynamoDbProductRepository } from "./dynamoDbProductRepository";
import { SnsEventPublisher } from "./snsEventPublisher";

const dynamoDbClient = new DynamoDBClient();
const snsClient = new SNSClient();

const createProductHandler = new CreateProductHandler(
  new DynamoDbProductRepository(dynamoDbClient),
  new SnsEventPublisher(snsClient)
);

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const mainSpan = tracer.scope().active();

  if (event.body === undefined) {
    return {
      statusCode: 400,
    };
  }

  const command: CreateProductCommand = JSON.parse(event.body);

  const result = await createProductHandler.handle(command);

  return {
    statusCode: result.success ? 201 : 400,
    body: JSON.stringify(result),
    headers: {
      "Content-Type": "application-json",
    },
  };
};
