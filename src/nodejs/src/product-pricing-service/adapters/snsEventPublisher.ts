//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { EventPublisher } from "../core/eventPublisher";
import { tracer } from "dd-trace";
import { PriceCalculatedEvent } from "../core/priceCalculatedEvent";

export class SnsEventPublisher implements EventPublisher {
  client: SNSClient;
  textEncoder: TextEncoder;

  constructor(client: SNSClient) {
    this.client = client;
    this.textEncoder = new TextEncoder();
  }
  async publishPriceCalculatedEvent(
    evt: PriceCalculatedEvent
  ): Promise<boolean> {
    const parentSpan = tracer.scope().active();

    const messagingSpan = tracer.startSpan("products.priceCalculated", {
      childOf: parentSpan!,
    });

    try {
      const toPublish = JSON.stringify(evt);

      messagingSpan.addTags({
        "messaging.operation.type": "publish",
        "messaging.system": "sns",
        "messaging.batch.message_count": 1,
        "messaging.destination.name": process.env.PRICE_CALCULATED_TOPIC_ARN,
        "messaging.message.body.size":
          this.textEncoder.encode(toPublish).length,
        "messaging.operation.name": "send",
      });

      await this.client.send(
        new PublishCommand({
          TopicArn: process.env.PRICE_CALCULATED_TOPIC_ARN,
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
}
