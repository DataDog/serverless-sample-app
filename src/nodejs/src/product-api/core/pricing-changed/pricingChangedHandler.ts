//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { PriceCalculatedEvent } from "../../private-events/priceCalculatedEvent";
import { HandlerResponse } from "../handlerResponse";
import { ProductDTO } from "../productDto";
import { ProductRepository } from "../productRepository";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({});

export class PricingChangedHandler {
  private repository: ProductRepository;

  constructor(repository: ProductRepository) {
    this.repository = repository;
  }

  public async handle(
    command: PriceCalculatedEvent
  ): Promise<HandlerResponse<ProductDTO>> {
    const span = tracer.scope().active()!;
    logger.info(`Handling price calculated event for product`, {
      'product.id': command.productId,
    });
    span.addTags({'product.id': command.productId});
    span.addTags({'product.pricingCount': command.priceBrackers.length});

    const existingProduct = await this.repository.getProduct(command.productId);

    if (existingProduct === undefined) {
      span.addTags({'product.notFound': true});
      return {
        data: undefined,
        success: false,
        message: ["Not found"],
      };
    }

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
