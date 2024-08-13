//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { HandlerResponse } from "../handlerResponse";
import { ProductDTO } from "../productDto";
import { ProductRepository } from "../productRepository";

export class GetProductQuery {
  productId: string;
}

export class GetProductHandler {
  private repository: ProductRepository;

  constructor(repository: ProductRepository) {
    this.repository = repository;
  }

  public async handle(
    query: GetProductQuery
  ): Promise<HandlerResponse<ProductDTO>> {
    try {
      const span = tracer.scope().active()!;
      const existingProduct = await this.repository.getProduct(query.productId);

      if (existingProduct === undefined) {
        return {
          data: undefined,
          success: false,
          message: ["Not found"],
        };
      }

      span.addTags({ "product.id": existingProduct.productId });

      return {
        data: {
          name: existingProduct.name,
          price: existingProduct.price,
          productId: existingProduct.productId,
          pricingBrackets: existingProduct.priceBrackets.map((item) => {
            return {
              quantity: item.quantity,
              price: item.price,
            };
          }),
        },
        success: true,
        message: [],
      };
    } catch (error) {
      return {
        data: undefined,
        success: false,
        message: ["Unknown error"],
      };
    }
  }
}
