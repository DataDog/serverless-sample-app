//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { EventPublisher } from "../eventPublisher";
import { HandlerResponse } from "../handlerResponse";
import { ProductDTO } from "../productDto";
import { ProductRepository } from "../productRepository";
import { ZodError } from "zod";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({});

export class UpdateProductCommand {
  productId: string;
  name: string;
  price: number;
}

export class UpdateProductHandler {
  private repository: ProductRepository;
  private eventPublisher: EventPublisher;

  constructor(repository: ProductRepository, eventPublisher: EventPublisher) {
    this.repository = repository;
    this.eventPublisher = eventPublisher;
  }

  public async handle(
    command: UpdateProductCommand
  ): Promise<HandlerResponse<ProductDTO>> {
    try {
      const span = tracer.scope().active()!;
      const existingProduct = await this.repository.getProduct(
        command.productId
      );

      if (existingProduct === undefined) {
        return {
          data: undefined,
          success: false,
          message: ["Not found"],
        };
      }

      existingProduct.update(command.name, command.price);

      if (!existingProduct.updated) {
        return {
          data: {
            name: existingProduct.name,
            price: existingProduct.price,
            productId: existingProduct.productId,
            pricingBrackets: existingProduct.priceBrackets,
          },
          success: true,
          message: ["No changes"],
        };
      }

      span.addTags({ "product.id": existingProduct.productId });

      await this.repository.updateProduct(existingProduct);
      await this.eventPublisher.publishProductUpdatedEvent({
        productId: existingProduct.productId,
        previous: {
          name: existingProduct.previousName,
          price: existingProduct.previousPrice,
        },
        new: {
          name: existingProduct.name,
          price: existingProduct.price,
        },
      });

      return {
        data: {
          name: existingProduct.name,
          price: existingProduct.price,
          productId: existingProduct.productId,
          pricingBrackets: existingProduct.priceBrackets,
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
