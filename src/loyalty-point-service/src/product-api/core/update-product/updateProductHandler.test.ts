//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { UpdateProductHandler } from "./updateProductHandler";
import { Mock, It, Times } from "moq.ts";
import exp = require("constants");
import { EventPublisher } from "../eventPublisher";
import { ProductRepository } from "../productRepository";
import { Product } from "../product";
import { ProductUpdatedEvent } from "../../private-events/productUpdatedEvent";

describe("update-product-handler", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date("2022-01-01"));
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  it("should return an error due to invalid data", async () => {
    const testId = "1234";
    const testName = "Widget";
    const testPrice = 12.99;

    const mockRepo = new Mock<ProductRepository>()
      .setup((instance) =>
        instance.getProduct(It.Is((value: string) => value === testId))
      )
      .returnsAsync(new Product(testName, testPrice));

    const mockEventPublisher = new Mock<EventPublisher>();

    const handler = new UpdateProductHandler(
      mockRepo.object(),
      mockEventPublisher.object()
    );

    const result = await handler.handle({
      productId: testId,
      name: "a",
      price: 0,
    });

    expect(result.message.length).toBe(2);
    expect(result.success).toBe(false);
  });

  it("should return an error due to product not found", async () => {
    const testId = "1234";

    const mockRepo = new Mock<ProductRepository>()
      .setup((instance) =>
        instance.getProduct(It.Is((value: string) => value === testId))
      )
      .returnsAsync(undefined);

    const mockEventPublisher = new Mock<EventPublisher>();

    const handler = new UpdateProductHandler(
      mockRepo.object(),
      mockEventPublisher.object()
    );

    const result = await handler.handle({
      productId: testId,
      name: "a",
      price: 0,
    });

    expect(result.message.length).toBe(1);
    expect(result.message[0]).toBe("Not found");
    expect(result.success).toBe(false);
  });

  it("should return success but with no changes", async () => {
    const testId = "1234";
    const name = "Widget";
    const price = 12.99;

    const mockRepo = new Mock<ProductRepository>()
      .setup((instance) =>
        instance.getProduct(It.Is((value: string) => value === testId))
      )
      .returnsAsync(new Product(name, price));

    const mockEventPublisher = new Mock<EventPublisher>();

    const handler = new UpdateProductHandler(
      mockRepo.object(),
      mockEventPublisher.object()
    );

    const result = await handler.handle({
      productId: testId,
      name: "Widget",
      price: 12.99,
    });

    expect(result.message.length).toBe(1);
    expect(result.message[0]).toBe("No changes");
    expect(result.success).toBe(true);
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
        instance.updateProduct(It.Is((value: Product) => value.productId === testId))
      )
      .returnsAsync(new Product(name, price));

    const mockEventPublisher = new Mock<EventPublisher>()
      .setup((instance) =>
        instance.publishProductUpdatedEvent(
          It.Is((value: ProductUpdatedEvent) => value.productId === testId)
        )
      )
      .returnsAsync(true);

    const handler = new UpdateProductHandler(
      mockRepo.object(),
      mockEventPublisher.object()
    );

    const result = await handler.handle({
      productId: testId,
      name: "A new widget",
      price: 14.99,
    });

    expect(result.message.length).toBe(0);
    expect(result.success).toBe(true);
  });
});
