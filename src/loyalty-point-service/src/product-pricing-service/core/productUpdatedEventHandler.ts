//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { EventPublisher } from "./eventPublisher";
import { PricingService } from "./pricingService";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({ serviceName: process.env.DD_SERVICE });

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
  private pricingService: PricingService;
  private eventPublisher: EventPublisher;

  constructor(pricingService: PricingService, eventPublisher: EventPublisher) {
    this.pricingService = pricingService;
    this.eventPublisher = eventPublisher;
  }

  async handle(evt: ProductUpdatedEvent): Promise<void> {
    const mainSpan = tracer.scope().active();
    mainSpan?.addTags({
      "pricing.previousPrice": evt.previous.price,
      "pricing.newPrice": evt.new.price,
      "product.id": evt.productId,
    });

    if (evt.previous.price === evt.new.price) {
      logger.info(
        `No pricing change. Previous: ${evt.previous.price}. New: ${evt.new.price}`
      );
      mainSpan?.addTags({ "pricing.noChange": true });
      return;
    }

    const priceResult = await this.pricingService.calculate(evt.new.price);

    this.eventPublisher.publishPriceCalculatedEvent({
      productId: evt.productId,
      priceBrackers: priceResult.map((price) => {
        return {
          quantity: price.quantityToOrder,
          price: price.price,
        };
      }),
    });
  }
}
