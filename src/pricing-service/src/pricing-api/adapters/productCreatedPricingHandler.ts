//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SNSClient } from "@aws-sdk/client-sns";
import { SNSEvent, SQSEvent } from "aws-lambda";
import { Span, tracer } from "dd-trace";
import {
  ProductCreatedEvent,
  ProductCreatedEventHandler,
} from "../core/productCreatedEventHandler";
import { PricingService } from "../core/pricingService";

import { CloudEvent } from "cloudevents";
import { MessagingType, startProcessSpanWithSemanticConventions } from "../../observability/observability";
import { EventBridgeEventPublisher } from "./eventBridgeEventPublisher";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";

const eventBridgeClient = new EventBridgeClient();

const createProductHandler = new ProductCreatedEventHandler(
  new PricingService(),
  new EventBridgeEventPublisher(eventBridgeClient)
);

export const handler = async (event: SNSEvent): Promise<string> => {
  const mainSpan = tracer.scope().active()!;
  mainSpan.addTags({
    "messaging.operation.type": "receive",
  });
  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;
    try {
      const evtWrapper: CloudEvent<ProductCreatedEvent> = JSON.parse(
        message.Sns.Message
      );
      
      messageProcessingSpan = startProcessSpanWithSemanticConventions(
        evtWrapper,
        {
          publicOrPrivate: MessagingType.PRIVATE,
          messagingSystem: "sns",
          destinationName: message.EventSource,
          parentSpan: mainSpan,
          conversationId: evtWrapper.data?.productId,
        }
      );

      await createProductHandler.handle(evtWrapper.data!);

      messageProcessingSpan.finish();
    } catch (error: unknown) {
      if (error instanceof Error) {
        const e = error as Error;
        const stack = e.stack!.split("\n").slice(1, 4).join("\n");
        messageProcessingSpan?.addTags({
          "error.stack": stack,
          "error.message": error.message,
          "error.type": "Error",
        });
      } else {
        messageProcessingSpan?.addTags({
          "error.type": "Error",
        });
      }

      messageProcessingSpan?.finish();

      throw error;

    } finally {
      messageProcessingSpan?.finish();
    }
  }

  return "OK";
};