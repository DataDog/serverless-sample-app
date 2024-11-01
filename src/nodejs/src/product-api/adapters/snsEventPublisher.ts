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
import { tracer } from "dd-trace";

export class SnsEventPublisher implements EventPublisher {
  client: SNSClient;
  textEncoder: TextEncoder;

  constructor(client: SNSClient) {
    this.client = client;
    this.textEncoder = new TextEncoder();
  }

  async publishProductCreatedEvent(evt: ProductCreatedEvent): Promise<boolean> {
    const parentSpan = tracer.scope().active();
    const messagingSpan = tracer.startSpan("products.productCreated", {
      childOf: parentSpan!,
    });

    try {
      const toPublish = JSON.stringify(evt);

      messagingSpan.addTags({
        "messaging.operation.type": "publish",
        "messaging.system": "sns",
        "messaging.batch.message_count": 1,
        "messaging.destination.name": process.env.PRODUCT_CREATED_TOPIC_ARN,
        "messaging.message.body.size":
          this.textEncoder.encode(toPublish).length,
        "messaging.operation.name": "send",
      });

      await this.client.send(
        new PublishCommand({
          TopicArn: process.env.PRODUCT_CREATED_TOPIC_ARN,
          Message: toPublish,
        })
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        const e = error as Error;
        const stack = e.stack!.split("\n").slice(1, 4).join("\n");
        messagingSpan.addTags({
          "error.stack": stack,
          "error.message": error.message,
          "error.type": "Error",
        });
      } else {
        messagingSpan.addTags({
          "error.type": "Error",
        });
      }
      return false;
    } finally {
      messagingSpan.finish();
    }

    return true;
  }

  async publishProductUpdatedEvent(evt: ProductUpdatedEvent): Promise<boolean> {
    const parentSpan = tracer.scope().active();
    const messagingSpan = tracer.startSpan("products.productCreated", {
      childOf: parentSpan!,
    });

    try {
      const toPublish = JSON.stringify(evt);

      messagingSpan.addTags({
        "messaging.operation.type": "publish",
        "messaging.system": "sns",
        "messaging.batch.message_count": 1,
        "messaging.destination.name": process.env.PRODUCT_UPDATED_TOPIC_ARN,
        "messaging.message.body.size":
          this.textEncoder.encode(toPublish).length,
        "messaging.operation.name": "send",
      });
      await this.client.send(
        new PublishCommand({
          TopicArn: process.env.PRODUCT_UPDATED_TOPIC_ARN,
          Message: JSON.stringify(evt),
        })
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        const e = error as Error;
        const stack = e.stack!.split("\n").slice(1, 4).join("\n");
        messagingSpan.addTags({
          "error.stack": stack,
          "error.message": error.message,
          "error.type": "Error",
        });
      } else {
        messagingSpan.addTags({
          "error.type": "Error",
        });
      }
      return false;
    } finally {
      messagingSpan.finish();
    }

    return true;
  }
  async publishProductDeletedEvent(evt: ProductDeletedEvent): Promise<boolean> {
    const parentSpan = tracer.scope().active();
    const messagingSpan = tracer.startSpan("products.productCreated", {
      childOf: parentSpan!,
    });

    try {
      const toPublish = JSON.stringify(evt);

      messagingSpan.addTags({
        "messaging.operation.type": "publish",
        "messaging.system": "sns",
        "messaging.batch.message_count": 1,
        "messaging.destination.name": process.env.PRODUCT_DELETED_TOPIC_ARN,
        "messaging.message.body.size":
          this.textEncoder.encode(toPublish).length,
        "messaging.operation.name": "send",
      });
      await this.client.send(
        new PublishCommand({
          TopicArn: process.env.PRODUCT_DELETED_TOPIC_ARN,
          Message: JSON.stringify(evt),
        })
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        const e = error as Error;
        const stack = e.stack!.split("\n").slice(1, 4).join("\n");
        messagingSpan.addTags({
          "error.stack": stack,
          "error.message": error.message,
          "error.type": "Error",
        });
      } else {
        messagingSpan.addTags({
          "error.type": "Error",
        });
      }
      return false;
    } finally {
      messagingSpan.finish();
    }

    return true;
  }
}
