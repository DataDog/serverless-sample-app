//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
  EventBridgeEvent,
} from "aws-lambda";
import { CloudEvent } from "cloudevents";
import {
  ProductCreatedEvent,
  ProductCreatedEventHandler,
} from "../core/productCreatedEventHandler";
import { PricingService } from "../core/pricingService";
import { EventBridgeEventPublisher } from "./eventBridgeEventPublisher";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { Logger } from "@aws-lambda-powertools/logger";
import { Span, tracer } from "dd-trace";
import {
  MessagingType,
  startProcessSpanWithSemanticConventions,
} from "../../observability/observability";

const eventBridgeClient = new EventBridgeClient();

// Initialize the event handler that comes from the `core` library, this seperates
// infrastructure code (the Lambda handler) from the business logic (the event handler).
const createProductHandler = new ProductCreatedEventHandler(
  new PricingService(),
  new EventBridgeEventPublisher(eventBridgeClient)
);
const logger = new Logger({ serviceName: process.env.DD_SERVICE });

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const mainSpan = tracer.scope().active()!;

  const batchItemFailures: SQSBatchItemFailure[] = [];

  // SQS always retrieves messages in batches, so we need to iterate over the batch of messages to process them
  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;

    try {
      // Events use the CloudEvents specification to provide a consistent structure to all events across the entire system
      // The SQS message body is a JSON string, so we need to parse it to get the CloudEvent
      const evtWrapper: EventBridgeEvent<"product.productCreated.v1",CloudEvent<ProductCreatedEvent>> = JSON.parse(message.body);

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

      // Finally, we handle the message itself using the handler initialized at the start of the file
      await createProductHandler.handle(evtWrapper.detail.data!);
    } catch (error: unknown) {
      const e = error as Error;
      const stack = e.stack!.split("\n").slice(1, 4).join("\n");
      messageProcessingSpan?.addTags({
        "error.stack": stack,
        "error.message": e.message,
        "error.type": "Error",
      });
      logger.error(e.message);
      logger.error(stack);

      // Rethrow error to pass back to Lambda runtime
      messageProcessingSpan?.finish();

      batchItemFailures.push({
        itemIdentifier: message.messageId,
      });
    }
    finally{
      messageProcessingSpan?.finish();
    }
  }

  return {
    batchItemFailures,
  };
};
