//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import { tracer } from "dd-trace";
import { Logger } from "@aws-lambda-powertools/logger";
import { OrderCreatedEventV1 } from "../public-events/orderCreatedEventV1";
import { EventAntiCorruptionLayer } from "../core/eventAntiCorruptionLayer";
import { SnsPrivateEventPublisher } from "./snsEventPublisher";
import { SNSClient } from "@aws-sdk/client-sns";

const logger = new Logger({});
const inventoryAcl = new EventAntiCorruptionLayer(
  new SnsPrivateEventPublisher(new SNSClient())
);

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const mainSpan = tracer.scope().active()!;
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const message of event.Records) {
    try {
      const evtWrapper: EventBridgeMessageWrapper<OrderCreatedEventV1> =
        JSON.parse(message.body);

      const result = await inventoryAcl.processOrderCreatedEvent(
        evtWrapper.detail
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
      mainSpan.finish();
    }
  }

  return {
    batchItemFailures,
  };
};

interface EventBridgeMessageWrapper<T> {
  detail: T;
}
