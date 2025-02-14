//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Logger } from "@aws-lambda-powertools/logger";
import { OrderCreatedIntegrationEventV1 } from "../public-events/orderCreatedIntegrationEventV1";
import { IntegrationEvent } from "./integrationEvent";
import { IntegrationEventPublisher } from "./integrationEventPublisher";
import { tracer } from "dd-trace";

const logger = new Logger({});

export interface ProductCreatedEvent {
  productId: string;
  name: string;
  price: number;
}

export class ProductCreatedEventHandler {
  private integrationEventPublisher: IntegrationEventPublisher;

  constructor(publisher: IntegrationEventPublisher) {
    this.integrationEventPublisher = publisher;
  }

  async handle(evt: ProductCreatedEvent): Promise<void> {
    const span = tracer.scope().active()!;

    span.addTags({"product.id": evt.productId});

    // Explicitally create V1 of event to allow for additional versions to be published in the future
    const v1Event: OrderCreatedIntegrationEventV1 = {
      productId: evt.productId,
    };

    let evtData = JSON.stringify(v1Event);

    if (evt.productId === 'BROKENWIDGET'){
      evtData = JSON.stringify({
        id: evt.productId
      });
    }

    logger.info(evtData);

    const evtsToPublish: IntegrationEvent[] = [
      {
        data: evtData,
        eventType: "product.productCreated.v1",
      },
    ];

    await this.integrationEventPublisher.publish(evtsToPublish);
  }
}
