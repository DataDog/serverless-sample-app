//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import { tracer } from "dd-trace";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { Logger } from "@aws-lambda-powertools/logger";
import { EventBridgeEventPublisher } from "./eventBridgeEventPublisher";
import {
  ProductCreatedEvent,
  ProductCreatedEventHandler,
} from "../core/productCreatedEventHandler";
import {
  ProductUpdatedEvent,
  ProductUpdatedEventHandler,
} from "../core/productUpdatedEvent";
import {
  ProductDeletedEvent,
  ProductDeletedEventHandler,
} from "../core/productDeletedEvent";

const integrationEventPublisher = new EventBridgeEventPublisher(
  new EventBridgeClient()
);
const productCreatedEventHandler = new ProductCreatedEventHandler(
  integrationEventPublisher
);
const productUpdatedEventHandler = new ProductUpdatedEventHandler(
  integrationEventPublisher
);
const productDeletedEventHandler = new ProductDeletedEventHandler(
  integrationEventPublisher
);

const logger = new Logger({});

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const mainSpan = tracer.scope().active();
  mainSpan?.addTags({
    "messaging.batch.message_count": event.Records.length,
    "messaging.operation.type": "receive",
    "messaging.system": "aws_sqs",
  });

  const sqsFailures: SQSBatchItemFailure[] = [];

  for (const message of event.Records) {
    const parentSpan = tracer.scope().active();
    const processingSpan = tracer.startSpan("process", {
      childOf: parentSpan!,
    });
    processingSpan.addTags({
      "messaging.system": "aws_sqs",
      "messaging.operation.type": "process",
    });

    try {
      const snsMessageWrapper: SnsMessageWrapper = JSON.parse(message.body);

      logger.info(`Processing message from ${snsMessageWrapper.TopicArn}`);

      switch (snsMessageWrapper.TopicArn) {
        case process.env.PRODUCT_CREATED_TOPIC_ARN:
          const createdEvt: ProductCreatedEvent = JSON.parse(snsMessageWrapper.Message);
          await productCreatedEventHandler.handle(createdEvt);
          break;
        case process.env.PRODUCT_UPDATED_TOPIC_ARN:
          const updatedEvt:ProductUpdatedEvent = JSON.parse(snsMessageWrapper.Message)
          await productUpdatedEventHandler.handle(updatedEvt);
          break;
        case process.env.PRODUCT_DELETED_TOPIC_ARN:
          const deletedEvt: ProductDeletedEvent = JSON.parse(snsMessageWrapper.Message)
          await productDeletedEventHandler.handle(deletedEvt);
          break;
        default:
          logger.warn(`Unknown event type: '${snsMessageWrapper.TopicArn}'`);
          processingSpan.addTags({
            "messaging.unknownType": snsMessageWrapper.TopicArn,
          });
          sqsFailures.push({
            itemIdentifier: message.messageId,
          });
      }
    } catch (error) {
      logger.error(JSON.stringify(error));
      processingSpan.logEvent("error", error);
      sqsFailures.push({
        itemIdentifier: message.messageId,
      });
    }

    processingSpan.finish();
  }

  return {
    batchItemFailures: sqsFailures,
  };
};

interface SnsMessageWrapper {
  Message: string;
  TopicArn: string;
}
