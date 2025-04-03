//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import {
  EventBridgeEvent,
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
} from "aws-lambda";
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
import { OrderCompletedEventV1 } from "../core/events/orderCompletedEventV1";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { EventBridgeEventPublisher } from "./eventBridgeEventPublisher";

const dynamoDbClient = new DynamoDBClient();
const eventBridgeClient = new EventBridgeClient();
const updatePointsCommandHandler = new UpdatePointsCommandHandler(
  new DynamoDbLoyaltyPointRepository(dynamoDbClient)
);
const logger = new Logger({});

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const mainSpan = tracer.scope().active()!;
  mainSpan.addTags({
    "messaging.operation.type": "receive",
  });

  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;

    try {
      const evtWrapper: EventBridgeEvent<
        "order.orderCompleted.v1",
        CloudEvent<OrderCompletedEventV1>
      > = JSON.parse(message.body);

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
        orderNumber: evtWrapper.detail.data!.orderNumber,
        userId: evtWrapper.detail.data!.userId,
        pointsToAdd: 50,
      });
    } catch (error) {
      batchItemFailures.push({
        itemIdentifier: message.messageId,
      });
      logger.error(JSON.stringify(error));
      messageProcessingSpan?.logEvent("error", error);

      messageProcessingSpan?.finish();
    } finally {
      messageProcessingSpan?.finish();
    }
  }

  return {
    batchItemFailures: batchItemFailures,
  };
};