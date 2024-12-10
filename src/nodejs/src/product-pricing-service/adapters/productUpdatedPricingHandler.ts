//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SNSClient } from "@aws-sdk/client-sns";
import { SNSEvent, SQSEvent } from "aws-lambda";
import { Span, tracer } from "dd-trace";
import { PricingService } from "../core/pricingService";
import { SnsEventPublisher } from "./snsEventPublisher";
import {
  ProductUpdatedEvent,
  ProductUpdatedEventHandler,
} from "../core/productUpdatedEventHandler";
import { Logger } from "@aws-lambda-powertools/logger";
import { CloudEvent } from "cloudevents";
import { generateProcessingSpanFor } from "../../observability/observability";
const logger = new Logger({ serviceName: process.env.DD_SERVICE });
const snsClient = new SNSClient();

const updateProductHandler = new ProductUpdatedEventHandler(
  new PricingService(),
  new SnsEventPublisher(snsClient)
);

export const handler = async (event: SNSEvent): Promise<string> => {
  const mainSpan = tracer.scope().active()!;
  mainSpan.addTags({
    "messaging.operation.type": "receive",
  });

  logger.info("Handling pricing updated event from SNS");

  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;
    try {
      const evtWrapper: CloudEvent<ProductUpdatedEvent> = JSON.parse(
        message.Sns.Message
      );

      messageProcessingSpan = generateProcessingSpanFor(evtWrapper, "sns", mainSpan, evtWrapper.data?.productId);
      
      await updateProductHandler.handle(evtWrapper.data!);

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
    } finally {
      messageProcessingSpan?.finish();
    }
  }

  return "OK";
};
