//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { PrivateEventPublisher } from "../core/eventPublisher";
import { ProductAddedEvent } from "../private-events/productAddedEvent";
import { tracer } from "dd-trace";

export class SnsPrivateEventPublisher implements PrivateEventPublisher {
  client: SNSClient;
  textEncoder: TextEncoder;

  constructor(client: SNSClient) {
    this.client = client;
    this.textEncoder = new TextEncoder();
  }

  async publish(evt: ProductAddedEvent): Promise<boolean> {
    const parentSpan = tracer.scope().active();
    const messagingSpan = tracer.startSpan("inventory.productAdded", {
      childOf: parentSpan!,
    });
    try {
      const toPublish = JSON.stringify(evt);

      messagingSpan.addTags({
        "messaging.operation.type": "publish",
        "messaging.system": "sns",
        "messaging.batch.message_count": 1,
        "messaging.destination.name": process.env.PRODUCT_ADDED_TOPIC_ARN,
        "messaging.message.body.size":
          this.textEncoder.encode(toPublish).length,
        "messaging.operation.name": "send",
      });

      await this.client.send(
        new PublishCommand({
          TopicArn: process.env.PRODUCT_ADDED_TOPIC_ARN,
          Message: toPublish,
        })
      );
    } catch (error: any) {
      const stack = error.stack.split("\n").slice(1, 4).join("\n");
      messagingSpan.addTags({
        "error.stack": stack,
        "error.message": error.message,
        "error.type": "Error",
      });
      return false;
    } finally {
      messagingSpan.finish();
    }

    return true;
  }
}
