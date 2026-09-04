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
import { EventPublisher } from "../core/eventPublisher";
import { Span, tracer } from "dd-trace";
import { CloudEvent } from "cloudevents";
import { randomUUID } from "crypto";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  MessagingType,
  startPublishSpanWithSemanticConventions,
} from "../../observability/observability";
import { LoyaltyPointsAddedV1 } from "../core/events/loyaltyPointsUpdatedV1";
import { LoyaltyPointsAddedV2 } from "../core/events/loyaltyPointsUpdatedV2";

export class EventBridgeEventPublisher implements EventPublisher {
  private client: EventBridgeClient;
  textEncoder: TextEncoder;
  logger: Logger;

  constructor(client: EventBridgeClient) {
    this.client = client;
    this.textEncoder = new TextEncoder();
    this.logger = new Logger({});
  }

  async publishLoyaltyPointsUpdated(evt: LoyaltyPointsAddedV2): Promise<void> {
    const parentSpan = tracer.scope().active();

    let messagingSpan: Span | undefined = undefined;

    try {
      const v1Event: LoyaltyPointsAddedV1 = {
        newPointsTotal: evt.totalPoints,
        userId: evt.userId,
      };

      const eventId = randomUUID();
      const traceparent = parentSpan?.context().toTraceparent();

      // Build a v2 CloudEvent to derive span tags.
      const v2EventForSpan = new CloudEvent({
        id: eventId,
        source: process.env.DOMAIN,
        type: "loyalty.pointsAdded.v2",
        datacontenttype: "application/json",
        data: evt,
        traceparent,
      });

      messagingSpan = startPublishSpanWithSemanticConventions(v2EventForSpan, {
        publicOrPrivate: MessagingType.PRIVATE,
        messagingSystem: "eventbridge",
        destinationName: process.env.EVENT_BUS_NAME ?? "",
        parentSpan: parentSpan,
      });

      const v1Detail = JSON.parse(
        JSON.stringify(
          new CloudEvent({
            id: eventId,
            source: process.env.DOMAIN,
            type: "loyalty.pointsAdded.v1",
            datacontenttype: "application/json",
            data: v1Event,
            traceparent,
            deprecationdate: new Date(2025, 11, 31).toISOString(),
            supercededby: "loyalty.pointsAdded.v2",
          })
        )
      );

      const v2Detail = JSON.parse(
        JSON.stringify(
          new CloudEvent({
            id: eventId,
            source: process.env.DOMAIN,
            type: "loyalty.pointsAdded.v2",
            datacontenttype: "application/json",
            data: evt,
            traceparent,
          })
        )
      );

      const evtEntries: PutEventsRequestEntry[] = [
        {
          EventBusName: process.env.EVENT_BUS_NAME,
          Detail: JSON.stringify(v1Detail),
          DetailType: "loyalty.pointsAdded.v1",
          Source: `${process.env.ENV}.loyalty`,
        },
        {
          EventBusName: process.env.EVENT_BUS_NAME,
          Detail: JSON.stringify(v2Detail),
          DetailType: "loyalty.pointsAdded.v2",
          Source: `${process.env.ENV}.loyalty`,
        },
      ];

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
      return;
    } finally {
      messagingSpan?.finish();
    }

    return;
  }
}
