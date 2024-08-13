//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import {
  SNSEvent,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { tracer } from "dd-trace";
import { DynamoDbProductRepository } from "./dynamoDbProductRepository";
import { PricingChangedHandler } from "../core/pricing-changed/pricingChangedHandler";
import { PriceCalculatedEvent } from "../private-events/priceCalculatedEvent";

const dynamoDbClient = new DynamoDBClient();
const pricingChangedHandler = new PricingChangedHandler(
  new DynamoDbProductRepository(dynamoDbClient)
);

export const handler = async (event: SNSEvent): Promise<string> => {
  const mainSpan = tracer.scope().active();

  for (const message of event.Records) {
    const data: PriceCalculatedEvent = JSON.parse(message.Sns.Message);

    await pricingChangedHandler.handle(data);
  }

  return "OK";
};
