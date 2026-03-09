//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { EventPublisher } from "./eventPublisher";
import { PipelineCheckpointRecorder } from "./pipelineCheckpointRecorder";
import { PricingService } from "./pricingService";
import { ProductApiClient } from "./productApiClient";

export interface ProductUpdatedEvent {
  productId: string;
}

export class ProductUpdatedEventHandler {
  private pricingService: PricingService;
  private eventPublisher: EventPublisher;
  private productApiClient: ProductApiClient;
  private checkpointRecorder: PipelineCheckpointRecorder;

  constructor(
    pricingService: PricingService,
    eventPublisher: EventPublisher,
    productApiClient: ProductApiClient,
    checkpointRecorder: PipelineCheckpointRecorder
  ) {
    this.pricingService = pricingService;
    this.eventPublisher = eventPublisher;
    this.productApiClient = productApiClient;
    this.checkpointRecorder = checkpointRecorder;
  }

  async handle(evt: ProductUpdatedEvent, linkedTraceparent?: string): Promise<void> {
    const mainSpan = tracer.scope().active();
    mainSpan?.addTags({ "product.id": evt.productId });

    const price = await this.productApiClient.getProductPrice(evt.productId);
    mainSpan?.addTags({ "pricing.price": price });

    await this.checkpointRecorder.recordCheckpoint(evt.productId, "generating_pricing");

    const priceResult = await this.pricingService.calculate({
      productId: evt.productId,
      price,
    });

    await this.eventPublisher.publishPriceCalculatedEvent(
      {
        productId: evt.productId,
        priceBrackets: priceResult.map((price) => ({
          quantity: price.quantityToOrder,
          price: price.price,
        })),
      },
      linkedTraceparent
    );

    await this.checkpointRecorder.recordCheckpoint(evt.productId, "pricing_published");
  }
}
