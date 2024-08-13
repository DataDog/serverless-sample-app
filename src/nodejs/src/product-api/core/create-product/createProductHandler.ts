//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { EventPublisher } from "../eventPublisher";
import { HandlerResponse } from "../handlerResponse";
import { Product } from "../product";
import { ProductDTO } from "../productDto";
import { ProductRepository } from "../productRepository";
import { z, ZodError } from "zod";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({});

export class CreateProductCommand {
  name: string;
  price: number;
}

export class CreateProductHandler {
  private repository: ProductRepository;
  private eventPublisher: EventPublisher;

  constructor(repository: ProductRepository, eventPublisher: EventPublisher) {
    this.repository = repository;
    this.eventPublisher = eventPublisher;
  }

  public async handle(
    command: CreateProductCommand
  ): Promise<HandlerResponse<ProductDTO>> {
    try {
      logger.info(`Handling request for product`);

      const span = tracer.scope().active()!;

      const product = new Product(command.name, command.price);

      await this.repository.createProduct(product);

      logger.info(
        `Product created with id '${product.productId}'. Publishing event`
      );

      await this.eventPublisher.publishProductCreatedEvent({
        productId: product.productId,
        name: product.name,
        price: product.price,
      });

      span.addTags({ "product.id": product.productId });

      return {
        data: {
          name: product.name,
          price: product.price,
          productId: product.productId,
          pricingBrackets: [],
        },
        success: true,
        message: [],
      };
    } catch (error) {
      logger.error(JSON.stringify(error));
      if (error instanceof ZodError) {
        return {
          data: undefined,
          success: false,
          message: (error as ZodError).errors.map((e) => e.message),
        };
      } else {
        return {
          data: undefined,
          success: false,
          message: ["Unknown error"],
        };
      }
    }
  }
}
