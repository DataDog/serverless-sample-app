//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { HandlerResponse } from "../handlerResponse";
import { ProductRepository } from "../productRepository";
import { ProductListDTO } from "../productListDto";

// no-dd-sa:typescript-best-practices/no-unnecessary-class
export class ListProductsQuery {
}

export class ListProductsHandler {
  private repository: ProductRepository;

  constructor(repository: ProductRepository) {
    this.repository = repository;
  }

  public async handle(
    query: ListProductsQuery
  ): Promise<HandlerResponse<ProductListDTO[]>> {
    try {
      const span = tracer.scope().active()!;
      const existingProducts = await this.repository.getProducts();

      return {
        data: existingProducts.map(existingProduct => {
          return {
            name: existingProduct.name,
            price: existingProduct.price,
            productId: existingProduct.productId,
            currentStockLevel: existingProduct.currentStockLevel,
          }
        }),
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
