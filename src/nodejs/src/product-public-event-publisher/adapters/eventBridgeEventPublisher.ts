//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsRequestEntry,
} from "@aws-sdk/client-eventbridge";
import { IntegrationEventPublisher } from "../core/integrationEventPublisher";
import { IntegrationEvent } from "../core/integrationEvent";
import { Span, tracer } from "dd-trace";
import { CloudEvent } from "cloudevents";
import {
  MessagingType,
  startPublishSpanWithSemanticConventions,
} from "../../observability/observability";

export class EventBridgeEventPublisher implements IntegrationEventPublisher {
  private client: EventBridgeClient;
  textEncoder: TextEncoder;

  constructor(client: EventBridgeClient) {
    this.client = client;
    this.textEncoder = new TextEncoder();
  }

  async publish(evt: IntegrationEvent[]): Promise<void> {
    const parentSpan = tracer.scope().active()!;
    try {
      const evtEntries: PutEventsRequestEntry[] = evt.map((e) => {
        const cloudEventWrapper = new CloudEvent({
          source: process.env.DOMAIN,
          type: e.eventType,
          datacontenttype: "application/json",
          data: e.data,
          traceparent: parentSpan?.context().toTraceparent(),
        });

        let messagingSpan: Span | undefined = undefined;

        messagingSpan = startPublishSpanWithSemanticConventions(
          cloudEventWrapper,
          {
            publicOrPrivate: MessagingType.PUBLIC,
            messagingSystem: "eventbridge",
            destinationName: process.env.EVENT_BUS_NAME ?? "",
            parentSpan: parentSpan,
          }
        );

        messagingSpan.finish();

        return {
          EventBusName: process.env.EVENT_BUS_NAME,
          Detail: JSON.stringify(cloudEventWrapper),
          DetailType: e.eventType,
          Source: `${process.env.ENV}.orders`,
        };
      });

      parentSpan.addTags({
        "messaging.batch.message_count": evtEntries.length,
      });

      await this.client.send(
        new PutEventsCommand({
          Entries: evtEntries,
        })
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        const e = error as Error;
        const stack = e.stack!.split("\n").slice(1, 4).join("\n");
        parentSpan?.addTags({
          "error.stack": stack,
          "error.message": error.message,
          "error.type": "Error",
        });
      } else {
        parentSpan?.addTags({
          "error.type": "Error",
        });
      }

      throw error;
    }

    return;
  }
}
