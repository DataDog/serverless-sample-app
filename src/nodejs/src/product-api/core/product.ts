//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { randomUUID } from "crypto";
import { z } from "zod";

export class Product {
  private productSchema = z
    .object({
      name: z.string().min(3, "Name must be at least 3 charachters"),
      price: z.number().gt(0, "Price must be greater than 0"),
    })
    .required()
    .strict();

  productId: string;
  previousName: string;
  name: string;
  price: number;
  previousPrice: number;
  updated: boolean = false;
  currentStockLevel: number;
  priceBrackets: ProductPriceBracket[] = [];

  constructor(name: string, price: number) {
    this.productSchema.parse({
      name,
      price,
    });
    this.name = name;
    this.price = price;
    this.productId = randomUUID().toString();
    this.currentStockLevel = 0;
  }

  update(name: string, price: number) {
    this.productSchema.parse({
      name,
      price,
    });

    if (this.name !== name) {
      this.previousName = this.name;
      this.name = name;
      this.updated = true;
    }

    if (this.price !== price) {
      this.previousPrice = this.price;
      this.price = price;
      this.updated = true;
    }
  }

  clearPricing() {
    this.priceBrackets = [];
  }

  addPrice(bracket: ProductPriceBracket) {
    this.priceBrackets.push(bracket);
  }

  setStockLevel(stockLevel: number) {
    this.currentStockLevel = stockLevel;
  }
}

export class ProductPriceBracket {
  quantity: number;
  price: number;
}
