//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { tracer } from "dd-trace";
import { GetProductHandler } from "../core/get-points/getPointsHandler";
import { addDefaultServiceTagsTo } from "../../observability/observability";
import { DynamoDbLoyaltyPointRepository } from "./dynamoDbLoyaltyPointRepository";
import { JwtPayload, verify } from "jsonwebtoken";
import { Logger } from "@aws-lambda-powertools/logger";
import { SSMClient } from "@aws-sdk/client-ssm";

const dynamoDbClient = new DynamoDBClient();
const queryHandler = new GetProductHandler(
  new DynamoDbLoyaltyPointRepository(dynamoDbClient)
);
const logger = new Logger({});

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const parameter = await getParameter(process.env.JWT_SECRET_PARAM_NAME!);

  const span = tracer.scope().active();
  addDefaultServiceTagsTo(span);

  let verificationResult: JwtPayload | string = "";

  try {
    verificationResult = verify(
      event.headers.Authorization!.replace("Bearer ", ""),
      parameter!
    );
  } catch (err: Error | any) {
    logger.warn("Unauthorized request", { error: err });
  }

  if (verificationResult.length === 0) {
    return {
      statusCode: 401,
      body: "Unauthorized",
      headers: {
        "Content-Type": "application-json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      },
    };
  }
  const userId = verificationResult.sub!.toString();

  if (userId === undefined) {
    return {
      statusCode: 401,
      body: "Unauthorized",
      headers: {
        "Content-Type": "application-json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*",
      },
    };
  }

  const result = await queryHandler.handle({
    userId: userId,
  });

  return {
    statusCode: result.success ? 200 : 404,
    body: JSON.stringify(result),
    headers: {
      "Content-Type": "application-json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    },
  };
};
