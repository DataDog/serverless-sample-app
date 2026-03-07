//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import { LambdaClient, SendDurableExecutionCallbackSuccessCommand } from "@aws-sdk/client-lambda";
import { Span, tracer } from "dd-trace";
import { CloudEvent } from "cloudevents";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  MessagingType,
  startProcessSpanWithSemanticConventions,
} from "../../observability/observability";
import { EventBridgeEvent } from "../../loyalty-api/adapters/eventBridgeEvent";


interface TierUpgradedEventData {
  userId: string;
  previousTier: string;
  newTier: string;
  currentPoints: number;
  upgradedAt: string;
  recommendations: Array<{ productId: string; name: string; price: number }>;
  callbackId: string;
}

const logger = new Logger();
const lambdaClient = new LambdaClient();

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const mainSpan = tracer.scope().active()!;
  mainSpan.addTags({
    "messaging.operation.type": "receive",
  });
  mainSpan.addTags({
    "messaging.batch.size": event.Records.length,
  });
  logger.info("Notification acknowledger received event with record count", {
    recordCount: event.Records.length,
  });

  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;

    try {
      const evtWrapper: EventBridgeEvent<CloudEvent<TierUpgradedEventData>> =
        JSON.parse(message.body);

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

      const evtData = evtWrapper.detail.data as TierUpgradedEventData;
      const callbackId = evtData?.callbackId;

      if (callbackId) {
        logger.info("Sending durable execution callback", { callbackId });

        await lambdaClient.send(
          new SendDurableExecutionCallbackSuccessCommand({
            CallbackId: callbackId,
            Result: JSON.stringify({ acknowledgedAt: new Date().toISOString() }),
          })
        );

        logger.info("Durable execution callback sent successfully", {
          callbackId,
        });
      } else {
        logger.warn("No callbackId found in tier upgraded event, skipping");
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
