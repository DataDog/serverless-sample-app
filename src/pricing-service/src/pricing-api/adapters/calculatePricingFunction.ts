//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { PricingService } from "../core/pricingService";
import { Logger } from "@aws-lambda-powertools/logger";
import { tracer } from "dd-trace";
import { addDefaultServiceTagsTo } from "../../observability/observability";

const logger = new Logger({ serviceName: process.env.DD_SERVICE });
const pricingService = new PricingService();

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,GET,PUT,DELETE",
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const mainSpan = tracer.scope().active();
  addDefaultServiceTagsTo(mainSpan);

  try {
    const body = JSON.parse(event.body ?? "{}");
    const { name, price } = body;

    if (price === undefined || price === null) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "price is required" }),
        headers: corsHeaders,
      };
    }

    mainSpan?.addTags({
      "pricing.price": price,
      "pricing.productName": name,
    });

    const pricingResults = await pricingService.calculate({
      productId: name,
      price,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(pricingResults),
      headers: corsHeaders,
    };
  } catch (error: unknown) {
    const e = error as Error;
    logger.error(e.message);
    mainSpan?.addTags({
      "error.message": e.message,
      "error.type": "Error",
    });

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
      headers: corsHeaders,
    };
  }
};
