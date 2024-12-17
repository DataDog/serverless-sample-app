//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { EventPublisher } from "../core/eventPublisher";
import { ProductCreatedEvent } from "../private-events/productCreatedEvent";
import { ProductDeletedEvent } from "../private-events/productDeletedEvent";
import { ProductUpdatedEvent } from "../private-events/productUpdatedEvent";
import { Span, tracer } from "dd-trace";
import { CloudEvent } from "cloudevents";
import { randomUUID } from "crypto";
import { Logger } from "@aws-lambda-powertools/logger";
import { MessagingType, startPublishSpanWithSemanticConventions } from "../../observability/observability";

export class SnsEventPublisher implements EventPublisher {
  client: SNSClient;
  textEncoder: TextEncoder;
  logger: Logger;

  constructor(client: SNSClient) {
    this.client = client;
    this.textEncoder = new TextEncoder();
    this.logger = new Logger({});
  }

  async publishProductCreatedEvent(evt: ProductCreatedEvent): Promise<boolean> {
    const parentSpan = tracer.scope().active();

    let messagingSpan: Span | undefined = undefined;

    try {
      const cloudEventWrapper = new CloudEvent({
        source: process.env.DOMAIN,
        type: "products.productCreated.v1",
        datacontenttype: "application/json",
        data: evt,
        traceparent: parentSpan?.context().toTraceparent(),
      });

      messagingSpan = startPublishSpanWithSemanticConventions(
        cloudEventWrapper,
        {
          publicOrPrivate: MessagingType.PRIVATE,
          messagingSystem: "sns",
          destinationName: process.env.PRODUCT_CREATED_TOPIC_ARN ?? "",
          parentSpan: parentSpan,
          conversationId: evt.productId
        }
      );

      await this.client.send(
        new PublishCommand({
          TopicArn: process.env.PRODUCT_CREATED_TOPIC_ARN,
          Message: JSON.stringify(cloudEventWrapper),
        })
      );
    } catch (error: unknown) {
      this.logger.error(JSON.stringify(error));
      if (error instanceof Error) {
        const e = error as Error;
        const stack = e.stack!.split("\n").slice(1, 4).join("\n");
        messagingSpan?.addTags({
          "error.stack": stack,
          "error.message": error.message,
          "error.type": "Error",
        });
      } else {
        messagingSpan?.addTags({
          "error.type": "Error",
        });
      }
      return false;
    } finally {
      messagingSpan?.finish();
    }

    return true;
  }

  async publishProductUpdatedEvent(evt: ProductUpdatedEvent): Promise<boolean> {
    const parentSpan = tracer.scope().active();

    let messagingSpan: Span | undefined = undefined;

    try {
      const cloudEventWrapper = new CloudEvent({
        source: process.env.DOMAIN,
        type: "products.productUpdated.v1",
        datacontenttype: "application/json",
        data: evt,
        traceparent: parentSpan?.context().toTraceparent(),
      });

      messagingSpan = startPublishSpanWithSemanticConventions(
        cloudEventWrapper,
        {
          publicOrPrivate: MessagingType.PRIVATE,
          messagingSystem: "sns",
          destinationName: process.env.PRODUCT_UPDATED_TOPIC_ARN ?? "",
          parentSpan: parentSpan,
          conversationId: evt.productId
        }
      );

      await this.client.send(
        new PublishCommand({
          TopicArn: process.env.PRODUCT_UPDATED_TOPIC_ARN,
          Message: JSON.stringify(cloudEventWrapper),
        })
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(JSON.stringify(error));
        const e = error as Error;
        const stack = e.stack!.split("\n").slice(1, 4).join("\n");
        messagingSpan?.addTags({
          "error.stack": stack,
          "error.message": error.message,
          "error.type": "Error",
        });
      } else {
        messagingSpan?.addTags({
          "error.type": "Error",
        });
      }
      return false;
    } finally {
      messagingSpan?.finish();
    }

    return true;
  }
  async publishProductDeletedEvent(evt: ProductDeletedEvent): Promise<boolean> {
    const parentSpan = tracer.scope().active();

    let messagingSpan: Span | undefined = undefined;

    try {
      const cloudEventWrapper = new CloudEvent({
        source: process.env.DOMAIN,
        type: "products.productDeleted.v1",
        datacontenttype: "application/json",
        data: evt,
        traceparent: parentSpan?.context().toTraceparent(),
      });

      messagingSpan = startPublishSpanWithSemanticConventions(
        cloudEventWrapper,
        {
          publicOrPrivate: MessagingType.PRIVATE,
          messagingSystem: "sns",
          destinationName: process.env.PRODUCT_DELETED_TOPIC_ARN ?? "",
          parentSpan: parentSpan,
          conversationId: evt.productId
        }
      );

      await this.client.send(
        new PublishCommand({
          TopicArn: process.env.PRODUCT_DELETED_TOPIC_ARN,
          Message: JSON.stringify(cloudEventWrapper),
        })
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(JSON.stringify(error));
        const e = error as Error;
        const stack = e.stack!.split("\n").slice(1, 4).join("\n");
        messagingSpan?.addTags({
          "error.stack": stack,
          "error.message": error.message,
          "error.type": "Error",
        });
      } else {
        messagingSpan?.addTags({
          "error.type": "Error",
        });
      }
      return false;
    } finally {
      messagingSpan?.finish();
    }

    return true;
  }
}
