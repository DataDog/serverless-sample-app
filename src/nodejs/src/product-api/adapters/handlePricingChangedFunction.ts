//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SNSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Span, tracer } from "dd-trace";
import { DynamoDbProductRepository } from "./dynamoDbProductRepository";
import { PricingChangedHandler } from "../core/pricing-changed/pricingChangedHandler";
import { PriceCalculatedEvent } from "../private-events/priceCalculatedEvent";
import { CloudEvent } from "cloudevents";
import { generateProcessingSpanFor } from "../../observability/observability";
import { Logger } from "@aws-lambda-powertools/logger";

const dynamoDbClient = new DynamoDBClient();
const pricingChangedHandler = new PricingChangedHandler(
  new DynamoDbProductRepository(dynamoDbClient)
);
const logger = new Logger({});

export const handler = async (event: SNSEvent): Promise<string> => {
  const mainSpan = tracer.scope().active()!;
  mainSpan.addTags({
    "messaging.operation.type": "receive",
  });

  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;

    const evtWrapper: CloudEvent<PriceCalculatedEvent> = JSON.parse(
      message.Sns.Message
    );

    try {
      messageProcessingSpan = generateProcessingSpanFor(evtWrapper, "sns", mainSpan, evtWrapper.data?.productId);

      await pricingChangedHandler.handle(evtWrapper.data!);
    } catch (error) {
      logger.error(JSON.stringify(error));
      messageProcessingSpan?.logEvent("error", error);
    } finally {
      messageProcessingSpan?.finish();
    }
  }

  return "OK";
};
