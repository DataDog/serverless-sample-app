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
import { Span, tracer, TracerProvider } from "dd-trace";
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
      // Still publish V2 for backwards compatibility, with a depreciation date.
      const v1Event: LoyaltyPointsAddedV1 = {
        newPointsTotal: evt.totalPoints,
        userId: evt.userId,
      };
      const v1CloudEventWrapper = new CloudEvent({
        source: process.env.DOMAIN,
        type: "loyalty.pointsAdded.v1",
        datacontenttype: "application/json",
        data: v1Event,
        traceparent: parentSpan?.context().toTraceparent(),
        deprecationdate: new Date(2025, 11, 31).toISOString(),
      });

      const cloudEventWrapper = new CloudEvent({
        source: process.env.DOMAIN,
        type: "loyalty.pointsAdded.v2",
        datacontenttype: "application/json",
        data: evt,
        traceparent: parentSpan?.context().toTraceparent()
      });

      messagingSpan = startPublishSpanWithSemanticConventions(
        cloudEventWrapper,
        {
          publicOrPrivate: MessagingType.PRIVATE,
          messagingSystem: "sns",
          destinationName: process.env.PRODUCT_CREATED_TOPIC_ARN ?? "",
          parentSpan: parentSpan,
        }
      );

      const evtEntries: PutEventsRequestEntry[] = [
        {
          EventBusName: process.env.EVENT_BUS_NAME,
          Detail: JSON.stringify(v1CloudEventWrapper),
          DetailType: "loyalty.pointsAdded.v1",
          Source: `${process.env.ENV}.loyalty`,
        },
        {
          EventBusName: process.env.EVENT_BUS_NAME,
          Detail: JSON.stringify(cloudEventWrapper),
          DetailType: "loyalty.pointsAdded.v2",
          Source: `${process.env.ENV}.loyalty`,
        },
      ];

      const headers = {};
      tracer.dataStreamsCheckpointer.setProduceCheckpoint(
        "sns",
        "loyalty.pointsAdded.v2",
        headers
      );

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
