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
import { randomUUID } from "crypto";
import { Logger } from "@aws-lambda-powertools/logger";
import {
  MessagingType,
  startPublishSpanWithSemanticConventions,
} from "../../../observability/observability";

export interface TierUpgradedEvent {
  userId: string;
  previousTier: string;
  newTier: string;
  currentPoints: number;
  upgradedAt: string;
  recommendations: Array<{ productId: string; name: string; price: number }>;
  callbackId: string;
}

export class EventBridgeTierPublisher {
  private client: EventBridgeClient;
  private logger: Logger;

  constructor(client: EventBridgeClient) {
    this.client = client;
    this.logger = new Logger({});
  }

  async publishTierUpgraded(evt: TierUpgradedEvent): Promise<void> {
    const parentSpan = tracer.scope().active();

    let messagingSpan: Span | undefined = undefined;

    try {
      const eventId = randomUUID();
      const traceparent = parentSpan?.context().toTraceparent();

      const cloudEvent = new CloudEvent({
        id: eventId,
        source: `${process.env.ENV}.loyalty`,
        type: "loyalty.tierUpgraded.v1",
        datacontenttype: "application/json",
        data: evt,
        traceparent,
      });

      const _datadog: Record<string, string> = {};

      messagingSpan = startPublishSpanWithSemanticConventions(
        cloudEvent,
        {
          publicOrPrivate: MessagingType.PRIVATE,
          messagingSystem: "eventbridge",
          destinationName: process.env.EVENT_BUS_NAME ?? "",
          parentSpan: parentSpan,
        },
        _datadog
      );

      const detail = {
        ...JSON.parse(JSON.stringify(cloudEvent)),
        _datadog,
      };

      const evtEntries: PutEventsRequestEntry[] = [
        {
          EventBusName: process.env.EVENT_BUS_NAME,
          Detail: JSON.stringify(detail),
          DetailType: "loyalty.tierUpgraded.v1",
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
      throw error;
    } finally {
      messagingSpan?.finish();
    }
  }
}
