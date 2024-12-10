//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { PrivateEventPublisher } from "../core/eventPublisher";
import { ProductAddedEvent } from "../private-events/productAddedEvent";
import { Span, tracer } from "dd-trace";
import { CloudEvent } from "cloudevents";
import { addMessagingTags } from "../../observability/observability";
import { randomUUID } from "crypto";

export class SnsPrivateEventPublisher implements PrivateEventPublisher {
  client: SNSClient;
  textEncoder: TextEncoder;

  constructor(client: SNSClient) {
    this.client = client;
    this.textEncoder = new TextEncoder();
  }

  async publish(evt: ProductAddedEvent): Promise<boolean> {
    const parentSpan = tracer.scope().active();

    const messagingSpan = tracer.startSpan("publish", {
      childOf: parentSpan!,
    });

    try {
      const toPublish = JSON.stringify(evt);
      const cloudEventWrapper = new CloudEvent({
        source: process.env.DOMAIN,
        type: "inventory.productAdded.v1",
        datacontenttype: "application/json",
        data: evt,
        traceparent: parentSpan?.context().toTraceparent(),
      });

      addMessagingTags(
        cloudEventWrapper,
        "sns",
        process.env.PRODUCT_ADDED_TOPIC_ARN ?? "",
        messagingSpan!,
        evt.productId,
        "private"
      );

      await this.client.send(
        new PublishCommand({
          TopicArn: process.env.PRODUCT_ADDED_TOPIC_ARN,
          Message: JSON.stringify(cloudEventWrapper),
        })
      );
    } catch (error: unknown) {
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
}
