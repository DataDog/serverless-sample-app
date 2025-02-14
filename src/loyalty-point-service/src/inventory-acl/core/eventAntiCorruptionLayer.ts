//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { z } from "zod";
import { OrderCreatedEventV1 } from "../public-events/orderCreatedEventV1";
import { Logger } from "@aws-lambda-powertools/logger";
import { tracer } from "dd-trace";
import { PrivateEventPublisher } from "./eventPublisher";

export class EventAntiCorruptionLayer {
  logger = new Logger({});
  private eventPublisher: PrivateEventPublisher;
  private expectedOrderCreatedSceham = z
    .object({
      productId: z.string().min(1, "ProductID must be passed in event"),
    })
    .required();

  constructor(eventPublisher: PrivateEventPublisher) {
    this.eventPublisher = eventPublisher;
  }

  async processOrderCreatedEvent(evt: OrderCreatedEventV1): Promise<boolean> {
    const span = tracer.scope().active()!;
    span.addTags({ "product.id": evt.productId });

    try {
      this.expectedOrderCreatedSceham.parse(evt);

      await this.eventPublisher.publish({
        productId: evt.productId,
      });

      return true;
    } catch (error: unknown) {
      if (error instanceof Error) {
        const e = error as Error;
        this.logger.error(JSON.stringify(e));
        const stack = e.stack!.split("\n").slice(1, 4).join("\n");
        span.addTags({
          "error.stack": stack,
          "error.message": error.message,
          "error.type": "Error",
        });
      } else {
        this.logger.error(JSON.stringify(error));
        span.addTags({
          "error.type": "Error",
        });
      }

      return false;
    }
  }
}
