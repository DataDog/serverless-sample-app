//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { tracer } from "dd-trace";
import { addDefaultServiceTagsTo } from "../../observability/observability";
import {
  SpendPointsCommand,
  SpendPointsCommandHandler,
} from "../core/spend-points/spendPointsHandler";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { DynamoDbLoyaltyPointRepository } from "./dynamoDbLoyaltyPointRepository";
import { JwtPayload, verify } from "jsonwebtoken";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { Logger } from "@aws-lambda-powertools/logger";

const dynamoDbClient = new DynamoDBClient();

const spendPointsHandler = new SpendPointsCommandHandler(
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

  if (event.body === undefined) {
    return {
      statusCode: 400,
    };
  }

  const command: SpendPointsCommand = JSON.parse(event.body);
  command.userId = userId;

  const result = await spendPointsHandler.handle(command);

  return {
    statusCode: result.success ? 201 : 400,
    body: JSON.stringify(result),
    headers: {
      "Content-Type": "application-json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST,GET,PUT,DELETE",
    },
  };
};
