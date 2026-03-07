//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Span, tracer } from "dd-trace";
import { CloudEvent } from "cloudevents";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  MessagingType,
  startProcessSpanWithSemanticConventions,
} from "../../observability/observability";
import { EventBridgeEvent } from "../../loyalty-api/adapters/eventBridgeEvent";

interface PointsAddedEventData {
  userId: string;
  totalPoints: number;
  difference: number;
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
  logger.info("Loyalty tier trigger received event with record count", {
    recordCount: event.Records.length,
  });

  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;

    try {
      const evtWrapper: EventBridgeEvent<CloudEvent<PointsAddedEventData>> =
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

      const evtData = evtWrapper.detail.data as PointsAddedEventData;
      const { userId, totalPoints } = evtData;

      logger.info("Starting tier upgrade orchestrator", { userId, totalPoints });

      await lambdaClient.send(
        new InvokeCommand({
          FunctionName: process.env.ORCHESTRATOR_FUNCTION_NAME!,
          InvocationType: "Event",
          Payload: Buffer.from(JSON.stringify({ userId, totalPoints })),
        })
      );
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
