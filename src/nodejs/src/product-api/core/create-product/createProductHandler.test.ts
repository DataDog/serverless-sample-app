//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { CreateProductHandler } from "./createProductHandler";
import { Mock, It, Times } from "moq.ts";
import exp = require("constants");
import { EventPublisher } from "../eventPublisher";
import { ProductCreatedEvent } from "../../private-events/productCreatedEvent";
import { ProductRepository } from "../productRepository";
import { Product } from "../product";

describe("create-product-handler", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date("2022-01-01"));
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  it("should return an error due to invalid data", async () => {
    const mockRepo = new Mock<ProductRepository>();
    const mockPublisher = new Mock<EventPublisher>();

    const handler = new CreateProductHandler(
      mockRepo.object(),
      mockPublisher.object()
    );

    const result = await handler.handle({
      name: "a",
      price: 0,
    });

    expect(result.message.length).toBe(2);
    expect(result.success).toBe(false);
  });

  it("should return an error due to invalid name", async () => {
    const mockRepo = new Mock<ProductRepository>();
    const mockPublisher = new Mock<EventPublisher>();

    const handler = new CreateProductHandler(
      mockRepo.object(),
      mockPublisher.object()
    );

    const result = await handler.handle({
      name: "a",
      price: 12.99,
    });

    expect(result.message.length).toBe(1);
    expect(result.success).toBe(false);
  });

  it("should return an error due to invalid price", async () => {
    const mockRepo = new Mock<ProductRepository>();
    const mockPublisher = new Mock<EventPublisher>();

    const handler = new CreateProductHandler(
      mockRepo.object(),
      mockPublisher.object()
    );

    const result = await handler.handle({
      name: "Widget",
      price: 0,
    });

    expect(result.message.length).toBe(1);
    expect(result.success).toBe(false);
  });

  it("should return success, data is valid", async () => {
    const testName = "Widget";
    const testPrice = 12.99;

    const mockRepo = new Mock<ProductRepository>()
      .setup((instance) =>
        instance.createProduct(
          It.Is((value: Product) => value.name === testName)
        )
      )
      .returnsAsync(new Product(testName, testPrice));

    const mockPublisher = new Mock<EventPublisher>()
      .setup((instance) =>
        instance.publishProductCreatedEvent(
          It.Is((value: ProductCreatedEvent) => value.name === testName)
        )
      )
      .returnsAsync(true);

    const handler = new CreateProductHandler(
      mockRepo.object(),
      mockPublisher.object()
    );

    const result = await handler.handle({
      name: testName,
      price: testPrice,
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe(testName);
    expect(result.data?.price).toBe(testPrice);
    expect(result.data?.productId).toBe("WIDGET");
  });

  it("should return success, and set valid productId", async () => {
    const testName = "A new widget";
    const testPrice = 12.99;

    const mockRepo = new Mock<ProductRepository>()
      .setup((instance) =>
        instance.createProduct(
          It.Is((value: Product) => value.name === testName)
        )
      )
      .returnsAsync(new Product(testName, testPrice));

    const mockPublisher = new Mock<EventPublisher>()
      .setup((instance) =>
        instance.publishProductCreatedEvent(
          It.Is((value: ProductCreatedEvent) => value.name === testName)
        )
      )
      .returnsAsync(true);

    const handler = new CreateProductHandler(
      mockRepo.object(),
      mockPublisher.object()
    );

    const result = await handler.handle({
      name: testName,
      price: testPrice,
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe(testName);
    expect(result.data?.price).toBe(testPrice);
    expect(result.data?.productId).toBe("ANEWWIDGET");
  });
});
