//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { PriceCalculatedEvent } from "../../private-events/priceCalculatedEvent";
import { EventPublisher } from "../eventPublisher";
import { HandlerResponse } from "../handlerResponse";
import { ProductDTO } from "../productDto";
import { ProductRepository } from "../productRepository";
import { z, ZodError } from "zod";

export class PricingChangedHandler {
  private repository: ProductRepository;

  constructor(repository: ProductRepository) {
    this.repository = repository;
  }

  public async handle(
    command: PriceCalculatedEvent
  ): Promise<HandlerResponse<ProductDTO>> {
    const span = tracer.scope().active()!;
    const existingProduct = await this.repository.getProduct(command.productId);

    if (existingProduct === undefined) {
      return {
        data: undefined,
        success: false,
        message: ["Not found"],
      };
    }

    span.addTags({ "product.id": existingProduct.productId });

    existingProduct.clearPricing();

    command.priceBrackers.forEach((element) => {
      existingProduct.addPrice({
        quantity: element.quantity,
        price: element.price,
      });
    });

    await this.repository.updateProduct(existingProduct);

    return {
      data: {
        name: existingProduct.name,
        price: existingProduct.price,
        productId: existingProduct.productId,
        pricingBrackets: existingProduct.priceBrackets
      },
      success: true,
      message: [],
    };
  }
}
