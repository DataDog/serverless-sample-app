//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import { Span, tracer } from "dd-trace";
import { Logger } from "@aws-lambda-powertools/logger";
import { EventAntiCorruptionLayer } from "../core/eventAntiCorruptionLayer";
import { SnsPrivateEventPublisher } from "./snsEventPublisher";
import { SNSClient } from "@aws-sdk/client-sns";
import { CloudEvent } from "cloudevents";
import {
  MessagingType,
  startProcessSpanWithSemanticConventions,
} from "../../observability/observability";
import { StockLevelUpdatedEventV1 } from "../public-events/StockLevelUpdatedEventV1";

const logger = new Logger({});
const productAcl = new EventAntiCorruptionLayer(
  new SnsPrivateEventPublisher(new SNSClient())
);

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const mainSpan = tracer.scope().active()!;
  mainSpan.addTags({
    "messaging.operation.type": "receive",
  });
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const message of event.Records) {
    let processingSpan: Span | undefined = undefined;

    try {
      const evtWrapper: EventBridgeMessageWrapper<CloudEvent<StockLevelUpdatedEventV1>> = 
        JSON.parse(message.body);

      processingSpan = startProcessSpanWithSemanticConventions(
        evtWrapper.detail,
        {
          publicOrPrivate: MessagingType.PUBLIC,
          messagingSystem: "sqs",
          destinationName: message.eventSource,
          parentSpan: mainSpan,
          conversationId: evtWrapper.detail.data!.productId,
        }
      );

      const result = await productAcl.processInventoryStockUpdatedEvent(
        evtWrapper.detail.data!
      );

      if (!result) {
        batchItemFailures.push({
          itemIdentifier: message.messageId,
        });
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        const e = error as Error;
        logger.error(JSON.stringify(e));
        const stack = e.stack!.split("\n").slice(1, 4).join("\n");
        mainSpan.addTags({
          "error.stack": stack,
          "error.message": error.message,
          "error.type": "Error",
        });
      } else {
        logger.error(JSON.stringify(error));
        mainSpan.addTags({
          "error.type": "Error",
        });
      }

      batchItemFailures.push({
        itemIdentifier: message.messageId,
      });
    } finally {
      processingSpan?.finish();
    }
  }

  return {
    batchItemFailures,
  };
};

interface EventBridgeMessageWrapper<T> {
  detail: T;
  detailType: string;
  source: string;
}
