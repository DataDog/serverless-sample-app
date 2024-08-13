//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Mock, It } from "moq.ts";
import { EventPublisher } from "../eventPublisher";
import { ProductRepository } from "../productRepository";
import { Product } from "../product";
import { DeleteProductHandler } from "./deleteProductHandler";
import { ProductDeletedEvent } from "../../private-events/productDeletedEvent";

describe("update-product-handler", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date("2022-01-01"));
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  it("should return an error due to product not found", async () => {
    const testId = "1234";

    const mockRepo = new Mock<ProductRepository>()
      .setup((instance) =>
        instance.getProduct(It.Is((value: string) => value === testId))
      )
      .returnsAsync(undefined);

    const mockEventPublisher = new Mock<EventPublisher>();

    const handler = new DeleteProductHandler(
      mockRepo.object(),
      mockEventPublisher.object()
    );

    const result = await handler.handle({
      productId: testId,
    });

    expect(result.message.length).toBe(1);
    expect(result.message[0]).toBe("Not found");
    expect(result.success).toBe(false);
  });

  it("should return success", async () => {
    const testId = "1234";
    const name = "Widget";
    const price = 12.99;

    const mockRepo = new Mock<ProductRepository>()
      .setup((instance) =>
        instance.getProduct(It.Is((value: string) => value === testId))
      )
      .returnsAsync(new Product(name, price))
      .setup((instance) =>
        instance.deleteProduct(It.Is((value: string) => value === testId))
      )
      .returnsAsync(true);

    const mockEventPublisher = new Mock<EventPublisher>()
      .setup((instance) =>
        instance.publishProductDeletedEvent(
          It.Is((value: ProductDeletedEvent) => value.productId === testId)
        )
      )
      .returnsAsync(true);

    const handler = new DeleteProductHandler(
      mockRepo.object(),
      mockEventPublisher.object()
    );

    const result = await handler.handle({
      productId: testId,
    });

    expect(result.message.length).toBe(0);
    expect(result.success).toBe(true);
  });
});
