//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import {
  PutEventsCommand,
  EventBridgeClient,
} from "@aws-sdk/client-eventbridge";
import { Span, tracer } from "dd-trace";
import { CloudEvent } from "cloudevents";
import { Logger } from "@aws-lambda-powertools/logger";
import { EventPublisher, StockLevelUpdatedEvent } from "../core/inventory";

export class EventBridgeEventPublisher implements EventPublisher {
  client: EventBridgeClient;
  textEncoder: TextEncoder;
  logger: Logger;

  constructor(client: EventBridgeClient) {
    this.client = client;
    this.textEncoder = new TextEncoder();
    this.logger = new Logger({});
  }

  async publish(evt: StockLevelUpdatedEvent): Promise<boolean> {
    const parentSpan = tracer.scope().active();

    let messagingSpan: Span | undefined = undefined;

    try {
      const cloudEventWrapper = new CloudEvent({
        source: process.env.DOMAIN,
        type: "inventory.stockUpdated.v1",
        datacontenttype: "application/json",
        data: evt,
        traceparent: parentSpan?.context().toTraceparent(),
      });

      messagingSpan = tracer.startSpan(`publish inventory.stockUpdated.v1`, {
        childOf: parentSpan ?? undefined,
      });

      await this.client.send(
        new PutEventsCommand({
          Entries: [
            {
              EventBusName: process.env.EVENT_BUS_NAME,
              Source: `${process.env.ENV}.inventory`,
              DetailType: cloudEventWrapper.type,
              Detail: JSON.stringify(cloudEventWrapper),
            },
          ],
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
}
