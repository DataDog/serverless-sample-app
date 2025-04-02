//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { EventPublisher } from "./eventPublisher";
import { PricingService } from "./pricingService";

export interface ProductCreatedEvent {
  productId: string;
  name: string;
  price: number;
}

export class ProductCreatedEventHandler {
  private pricingService: PricingService;
  private eventPublisher: EventPublisher;

  constructor(pricingService: PricingService, eventPublisher: EventPublisher) {
    this.pricingService = pricingService;
    this.eventPublisher = eventPublisher;
  }

  async handle(evt: ProductCreatedEvent): Promise<void> {
    // if (evt.productId === undefined) {
    //   throw new Error("Product ID is undefined");
    // }
    // if (evt.price === undefined) {
    //   throw new Error("Price is undefined");
    // }

    const span = tracer.scope().active();

    span?.addTags({
      "product.id": evt.productId,
      "pricing.newPrice": evt.price,
    });

    const priceResult = await this.pricingService.calculate({
      productId: evt.productId,
      price: evt.price,
    });

    this.eventPublisher.publishPriceCalculatedEvent({
      productId: evt.productId,
      priceBrackets: priceResult.map((price) => {
        return {
          quantity: price.quantityToOrder,
          price: price.price,
        };
      }),
    });
  }
}
