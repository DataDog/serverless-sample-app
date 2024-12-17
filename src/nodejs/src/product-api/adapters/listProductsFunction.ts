//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDbProductRepository } from "./dynamoDbProductRepository";
import { ListProductsHandler } from "../core/list-products/listProductsHandler";
import { tracer } from "dd-trace";
import { addDefaultServiceTagsTo } from "../../observability/observability";

const dynamoDbClient = new DynamoDBClient();
const queryHandler = new ListProductsHandler(
  new DynamoDbProductRepository(dynamoDbClient)
);

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const span = tracer.scope().active();
  addDefaultServiceTagsTo(span);
  
  const result = await queryHandler.handle({});

  return {
    statusCode: result.success ? 200 : 500,
    body: JSON.stringify(result),
    headers: {
      "Content-Type": "application-json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    },
  };
};
