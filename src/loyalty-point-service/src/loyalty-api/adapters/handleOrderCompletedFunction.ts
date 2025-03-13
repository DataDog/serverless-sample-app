//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SNSEvent, SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Span, tracer } from "dd-trace";
import { CloudEvent } from "cloudevents";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  MessagingType,
  startProcessSpanWithSemanticConventions,
} from "../../observability/observability";
import { UpdatePointsCommandHandler } from "../core/update-points/update-points-handler";
import { DynamoDbLoyaltyPointRepository } from "./dynamoDbLoyaltyPointRepository";
import { OrderCompletedEventV1 } from "../events/orderCompletedEventV1";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { EventBridgeEventPublisher } from "./eventBridgeEventPublisher";

const dynamoDbClient = new DynamoDBClient();
const eventBridgeClient = new EventBridgeClient();
const updatePointsCommandHandler = new UpdatePointsCommandHandler(
  new DynamoDbLoyaltyPointRepository(dynamoDbClient),
  new EventBridgeEventPublisher(eventBridgeClient)
);
const logger = new Logger({});

export const handler = async (event: SQSEvent): Promise<string> => {
  const mainSpan = tracer.scope().active()!;
  mainSpan.addTags({
    "messaging.operation.type": "receive",
  });

  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;

    try {
      const evtWrapper: EventBridgeMessageWrapper<CloudEvent<string>> =
        JSON.parse(message.body);
      const evtData: OrderCompletedEventV1 = JSON.parse(
        evtWrapper.detail.data!
      );

      messageProcessingSpan = startProcessSpanWithSemanticConventions(
        evtWrapper.detail,
        {
          publicOrPrivate: MessagingType.PUBLIC,
          messagingSystem: "eventbridge",
          destinationName: message.eventSource,
          parentSpan: mainSpan,
        }
      );

      await updatePointsCommandHandler.handle({
        orderNumber: evtData.orderNumber,
        userId: evtData.userId,
        pointsToAdd: 50,
      });
    } catch (error) {
      logger.error(JSON.stringify(error));
      messageProcessingSpan?.logEvent("error", error);

      // Rethrow error to pass back to Lambda runtime
      messageProcessingSpan?.finish();
      throw error;
    } finally {
      messageProcessingSpan?.finish();
    }
  }

  return "OK";
};

interface EventBridgeMessageWrapper<T> {
  detail: T;
  detailType: string;
  source: string;
}
