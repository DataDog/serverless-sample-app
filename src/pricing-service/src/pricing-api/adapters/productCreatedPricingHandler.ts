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

const createProductHandler = new ProductCreatedEventHandler(
  new PricingService(),
  new EventBridgeEventPublisher(eventBridgeClient)
);
const logger = new Logger({ serviceName: process.env.DD_SERVICE });

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const mainSpan = tracer.scope().active()!;

  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;

    try {
      const evtWrapper: EventBridgeEvent<"product.productCreated.v1",CloudEvent<ProductCreatedEvent>> = JSON.parse(message.body);

      messageProcessingSpan = startProcessSpanWithSemanticConventions(
        evtWrapper.detail,
        {
          publicOrPrivate: MessagingType.PUBLIC,
          messagingSystem: "eventbridge",
          destinationName: message.eventSource,
          parentSpan: mainSpan,
        }
      );

      await createProductHandler.handle(evtWrapper.detail.data!);
    } catch (error: unknown) {
      logger.error(JSON.stringify(error));
      messageProcessingSpan?.logEvent("error", error);

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
