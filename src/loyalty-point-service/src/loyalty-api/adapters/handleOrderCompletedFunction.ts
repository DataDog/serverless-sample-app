//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
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
import { OrderCompletedEventV2 } from "../core/events/orderCompletedEventV2";
import { EventBridgeEvent } from "./eventBridgeEvent";

const logger = new Logger();
const dynamoDbClient = new DynamoDBClient();
const updatePointsCommandHandler = new UpdatePointsCommandHandler(
  new DynamoDbLoyaltyPointRepository(dynamoDbClient, logger)
);

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const mainSpan = tracer.scope().active()!;
  mainSpan.addTags({
    "messaging.operation.type": "receive",
  });
  mainSpan.addTags({
    "messaging.batch.size": event.Records.length,
  });
  logger.info("Loyalty function received event with record count", {
    recordCount: event.Records.length,
  });

  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;

    try {
      const evtWrapper: EventBridgeEvent<CloudEvent<any>> = JSON.parse(
        message.body
      );

      logger.info(evtWrapper.detail.type);

      messageProcessingSpan = startProcessSpanWithSemanticConventions(
        evtWrapper.detail,
        {
          publicOrPrivate: MessagingType.PUBLIC,
          messagingSystem: "eventbridge",
          destinationName: message.eventSource,
          parentSpan: mainSpan,
        }
      );

      const deprecationDate = evtWrapper.detail.deprecationdate;

      if (deprecationDate) {
        messageProcessingSpan?.setTag(
          "messaging.message.deprecation_date",
          deprecationDate
        );
        messageProcessingSpan.setTag(
          "messaging.message.superceded_by",
          evtWrapper.detail.supercededby ?? "unknown"
        );
        messageProcessingSpan.setTag("messaging.message.deprecated", true);
      }

      if (evtWrapper.detail.type.indexOf("v1") > 0) {
        const evtData = evtWrapper.detail.data as OrderCompletedEventV1;
        await updatePointsCommandHandler.handle({
          orderNumber: evtData.orderNumber,
          userId: evtData.userId,
          pointsToAdd: 50,
        });
      } else if (evtWrapper.detail.type.indexOf("v2") > 0) {
        const evtData = evtWrapper.detail.data as OrderCompletedEventV2;
        await updatePointsCommandHandler.handle({
          orderNumber: evtData.orderId,
          userId: evtData.userId,
          pointsToAdd: 50,
        });
      } else {
        logger.warn("Loyalty function received unsupported event version");
        throw new Error(`Unsupported event version ${evtWrapper.detail.type}`);
      }
    } catch (error) {
      batchItemFailures.push({
        itemIdentifier: message.messageId,
      });
      logger.error(JSON.stringify(error));
      messageProcessingSpan?.logEvent("error", error);
    }

    messageProcessingSpan?.finish();
  }

  return {
    batchItemFailures: batchItemFailures,
  };
};
