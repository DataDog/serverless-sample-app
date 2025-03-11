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
import { Span, tracer } from "dd-trace";
import { CloudEvent } from "cloudevents";
import { Logger } from "@aws-lambda-powertools/logger";
import { MessagingType, startPublishSpanWithSemanticConventions } from "../../observability/observability";
import { EventPublisher } from "../core/eventPublisher";
import { PriceCalculatedEventV1 } from "../events/priceCalculatedEventV1";

export class EventBridgeEventPublisher implements EventPublisher {
  private client: EventBridgeClient;
  textEncoder: TextEncoder;
  logger: Logger;

  constructor(client: EventBridgeClient) {
    this.client = client;
    this.textEncoder = new TextEncoder();
    this.logger = new Logger({});
  }

  async publishPriceCalculatedEvent(evt: PriceCalculatedEventV1): Promise<boolean> {
    const parentSpan = tracer.scope().active();

    let messagingSpan: Span | undefined = undefined;

    try {
      const cloudEventWrapper = new CloudEvent({
        source: process.env.DOMAIN,
        type: "pricing.pricingCalculated.v1",
        datacontenttype: "application/json",
        data: evt,
        traceparent: parentSpan?.context().toTraceparent(),
      });

      messagingSpan = startPublishSpanWithSemanticConventions(
        cloudEventWrapper,
        {
          publicOrPrivate: MessagingType.PUBLIC,
          messagingSystem: "eventbridge",
          destinationName: process.env.EVENT_BUS_NAME ?? "",
          parentSpan: parentSpan,
        }
      );

      const evtEntries: PutEventsRequestEntry[] = [
        {
          EventBusName: process.env.EVENT_BUS_NAME,
          Detail: JSON.stringify(cloudEventWrapper),
          DetailType: "pricing.pricingCalculated.v1",
          Source: `${process.env.ENV}.pricing`,
        }
      ]

      await this.client.send(
        new PutEventsCommand({
          Entries: evtEntries,
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
