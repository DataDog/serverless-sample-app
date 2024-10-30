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
import { tracer } from "dd-trace";

export class EventBridgeEventPublisher implements IntegrationEventPublisher {
  private client: EventBridgeClient;

  constructor(client: EventBridgeClient) {
    this.client = client;
  }

  async publish(evt: IntegrationEvent[]): Promise<void> {
    const parentSpan = tracer.scope().active();
    const messagingSpan = tracer.startSpan(evt[0].eventType, {
      childOf: parentSpan!,
    });
    try {
      const evtEntries: PutEventsRequestEntry[] = evt.map((e) => {
        messagingSpan.addTags({
          "messaging.detailType": e.eventType,
          "messaging.source": `${process.env.ENV}.orders`,
        });

        return {
          EventBusName: process.env.EVENT_BUS_NAME,
          Detail: e.data,
          DetailType: e.eventType,
          Source: `${process.env.ENV}.orders`,
        };
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
    } finally {
      messagingSpan.finish();
    }

    return;
  }
}
