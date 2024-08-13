//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Mock, It, Times } from "moq.ts";
import exp = require("constants");
import { PricingService } from "./pricingService";
import { ProductCreatedEventHandler } from "./productCreatedEventHandler";
import { EventPublisher } from "./eventPublisher";
import { PriceCalculatedEvent } from "./priceCalculatedEvent";
import { ProductUpdatedEventHandler } from "./productUpdatedEventHandler";

describe("pricing-product-updated-handler", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date("2022-01-01"));
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  it("should calculate price and publish event", async () => {
    const testId = "test-id";

    const mockEventPublisher = new Mock<EventPublisher>()
      .setup((instance) =>
        instance.publishPriceCalculatedEvent(
          It.Is(
            (value: PriceCalculatedEvent) =>
              value.productId === testId && value.priceBrackers.length === 5
          )
        )
      )
      .returnsAsync(true);

    const pricingService = new PricingService();
    const handler = new ProductUpdatedEventHandler(
      pricingService,
      mockEventPublisher.object()
    );

    const result = await handler.handle({
      productId: testId,
      new: {
        name: "test",
        price: 12.99,
      },
      previous: {
        name: "test",
        price: 13.99,
      },
    });

    mockEventPublisher.verify(
      (instance) => instance.publishPriceCalculatedEvent(It.IsAny()),
      Times.Once()
    );
  });

  it("when no price change, should not publish event", async () => {
    const testId = "test-id";

    const mockEventPublisher = new Mock<EventPublisher>()
      .setup((instance) =>
        instance.publishPriceCalculatedEvent(
          It.Is(
            (value: PriceCalculatedEvent) =>
              value.productId === testId && value.priceBrackers.length === 5
          )
        )
      )
      .returnsAsync(true);

    const pricingService = new PricingService();
    const handler = new ProductUpdatedEventHandler(
      pricingService,
      mockEventPublisher.object()
    );

    const result = await handler.handle({
      productId: testId,
      new: {
        name: "test",
        price: 12.99,
      },
      previous: {
        name: "test",
        price: 12.99,
      },
    });

    mockEventPublisher.verify(
      (instance) => instance.publishPriceCalculatedEvent(It.IsAny()),
      Times.Never()
    );
  });
});
