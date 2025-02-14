//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { OrderUpdatedIntegrationEventV1 } from "../public-events/orderUpdatedIntegrationEventV1";
import { IntegrationEvent } from "./integrationEvent";
import { IntegrationEventPublisher } from "./integrationEventPublisher";

export interface ProductUpdatedEvent {
  productId: string;
  previous: {
    name: string;
    price: number;
  };
  new: {
    name: string;
    price: number;
  };
}

export class ProductUpdatedEventHandler {
  private integrationEventPublisher: IntegrationEventPublisher;

  constructor(publisher: IntegrationEventPublisher) {
    this.integrationEventPublisher = publisher;
  }

  async handle(evt: ProductUpdatedEvent): Promise<void> {
    const span = tracer.scope().active()!;

    span.addTags({ "product.id": evt.productId });

    // Explicatally create V1 of event to allow for additional versions to be published in the future
    const v1Event: OrderUpdatedIntegrationEventV1 = {
      productId: evt.productId,
    };

    const evtsToPublish: IntegrationEvent[] = [
      {
        data: JSON.stringify(v1Event),
        eventType: "product.productUpdated.v1",
      },
    ];

    await this.integrationEventPublisher.publish(evtsToPublish);
  }
}
