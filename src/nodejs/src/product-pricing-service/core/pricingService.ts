//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { setTimeout } from "timers/promises";

export interface PricingResult {
  quantityToOrder: number;
  price: number;
}

export class PricingService {
  public async calculate(price: number): Promise<PricingResult[]> {
    // This is functionality to force errors and demonstrate capabilities
    if (price > 50 && price < 60) {
      await setTimeout(5000);
    }

    if (price > 90 && price < 95){
      throw Error('Failure generating prices')
    }

    const pricingResults: PricingResult[] = [
      {
        quantityToOrder: 5,
        price: round2Dp(price * 0.95),
      },
      {
        quantityToOrder: 10,
        price: round2Dp(price * 0.9),
      },
      {
        quantityToOrder: 25,
        price: round2Dp(price * 0.8),
      },
      {
        quantityToOrder: 50,
        price: round2Dp(price * 0.75),
      },
      {
        quantityToOrder: 100,
        price: round2Dp(price * 0.7),
      },
    ];

    return pricingResults;
  }
}

function round2Dp(input: number): number {
  return Math.round(input * 100) / 100;
}
