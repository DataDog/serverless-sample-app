//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { tracer } from "dd-trace";
import { GetProductHandler } from "../core/get-product/getProductHandler";
import { DynamoDbProductRepository } from "./dynamoDbProductRepository";
import { addDefaultServiceTagsTo } from "../../observability/observability";

let isInitialized = false;
const dynamoDbClient = new DynamoDBClient();
const queryHandler = new GetProductHandler(
  new DynamoDbProductRepository(dynamoDbClient)
);

async function simulateColdStart() {
  if (!isInitialized) {
    const span = tracer.scope().active();
    const coldStartSpan = tracer.startSpan("A long cold start task", {
      childOf: span!
    });

    await new Promise(resolve => setTimeout(resolve, 5000));
    isInitialized = true;

    coldStartSpan.finish();
  }
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  await simulateColdStart();

  const span = tracer.scope().active();
  addDefaultServiceTagsTo(span);

  const productId = event.pathParameters!["productId"];

  if (productId === undefined) {
    return {
      statusCode: 400,
      body: "Must provide productId",
      headers: {
        "Content-Type": "application-json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*"
      }
    };
  }

  const result = await queryHandler.handle({
    productId,
  });

  return {
    statusCode: result.success ? 200 : 404,
    body: JSON.stringify(result),
    headers: {
      "Content-Type": "application-json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*"
    },
  };
};
