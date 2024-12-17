//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { EventPublisher } from "../eventPublisher";
import { HandlerResponse } from "../handlerResponse";
import { ProductRepository } from "../productRepository";
import { ZodError } from "zod";
import { Logger } from "@aws-lambda-powertools/logger";

export class DeleteProductCommand {
  productId: string;
}

const logger = new Logger({});

export class DeleteProductHandler {
  private repository: ProductRepository;
  private eventPublisher: EventPublisher;

  constructor(repository: ProductRepository, eventPublisher: EventPublisher) {
    this.repository = repository;
    this.eventPublisher = eventPublisher;
  }

  public async handle(
    command: DeleteProductCommand
  ): Promise<HandlerResponse<string>> {
    try {
      const span = tracer.scope().active()!;
      logger.info(`Handling request for product`, {
        'product.id': command.productId,
      });
      span.addTags({'product.id': command.productId});
      
      const existingProduct = await this.repository.getProduct(
        command.productId
      );

      if (existingProduct === undefined) {
        span.addTags({'product.notFound': true});

        return {
          data: undefined,
          success: false,
          message: ["Not found"],
        };
      }

      await this.repository.deleteProduct(existingProduct.productId);
      await this.eventPublisher.publishProductDeletedEvent({
        productId: existingProduct.productId,
      });

      return {
        data: "Deleted",
        success: true,
        message: [],
      };
    } catch (error) {
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
