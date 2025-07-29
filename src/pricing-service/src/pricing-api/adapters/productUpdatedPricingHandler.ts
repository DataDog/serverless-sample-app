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
import { PricingService } from "../core/pricingService";
import {
  ProductUpdatedEvent,
  ProductUpdatedEventHandler,
} from "../core/productUpdatedEventHandler";
import { Logger } from "@aws-lambda-powertools/logger";
import { EventBridgeEventPublisher } from "./eventBridgeEventPublisher";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { CloudEvent } from "cloudevents";
import { Span, tracer } from "dd-trace";
import {
  MessagingType,
  startProcessSpanWithSemanticConventions,
} from "../../observability/observability";

const logger = new Logger({ serviceName: process.env.DD_SERVICE });
const eventBridgeClient = new EventBridgeClient();

const updateProductHandler = new ProductUpdatedEventHandler(
  new PricingService(),
  new EventBridgeEventPublisher(eventBridgeClient)
);

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const mainSpan = tracer.scope().active()!;

  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;
    try {
      const evtWrapper: EventBridgeEvent<
        "product.productUpdated.v1",
        CloudEvent<ProductUpdatedEvent>
      > = JSON.parse(message.body);

      // A processing span is started for each message, following the OpenTelemetry semantic conventions for messaging
      messageProcessingSpan = startProcessSpanWithSemanticConventions(
        evtWrapper.detail,
        {
          publicOrPrivate: MessagingType.PUBLIC,
          messagingSystem: "eventbridge",
          destinationName: message.eventSource,
          parentSpan: mainSpan,
        }
      );

      await updateProductHandler.handle(evtWrapper.detail.data!);
    } catch (error: unknown) {
      if (error instanceof Error) {
        const e = error as Error;
        const stack = e.stack!.split("\n").slice(1, 4).join("\n");
        logger.error(e.message);
        logger.error(e.stack ?? "");
        messageProcessingSpan?.addTags({
          "error.stack": stack,
          "error.message": e.message,
          "error.type": "Error",
        });
      }

      batchItemFailures.push({
        itemIdentifier: message.messageId,
      });
    } finally {
      messageProcessingSpan?.finish();
    }
  }

  return {
    batchItemFailures,
  };
};
