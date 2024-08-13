//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Mock, It, Times } from "moq.ts";
import exp = require("constants");
import { PrivateEventPublisher } from "./eventPublisher";
import { ProductAddedEvent } from "../private-events/productAddedEvent";
import { EventAntiCorruptionLayer } from "./eventAntiCorruptionLayer";
import { OrderCreatedEventV1 } from "../public-events/orderCreatedEventV1";

describe("inventory-anti-corruption-layer", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date("2022-01-01"));
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  it("when-input-event-is-valid-should-translate-and-publish", async () => {
    const testId = "test-id";

    const mockEventPublisher = new Mock<PrivateEventPublisher>()
      .setup((instance) =>
        instance.publish(
          It.Is((value: ProductAddedEvent) => value.productId === testId)
        )
      )
      .returnsAsync(true);

    const eventAntiCorruptionLayer = new EventAntiCorruptionLayer(
      mockEventPublisher.object()
    );

    const result = await eventAntiCorruptionLayer.processOrderCreatedEvent({
      productId: testId,
    });

    expect(result).toBe(true);
    mockEventPublisher.verify(
      (instance) =>
        instance.publish(
          It.Is((param: ProductAddedEvent) => param.productId === testId)
        ),
      Times.Once()
    );
  });

  it("when-input-event-is-missing-product-id-should-not-publish", async () => {
    const testId = "test-id";

    const mockEventPublisher = new Mock<PrivateEventPublisher>()
      .setup((instance) =>
        instance.publish(
          It.Is((value: ProductAddedEvent) => value.productId === testId)
        )
      )
      .returnsAsync(true);

    const eventAntiCorruptionLayer = new EventAntiCorruptionLayer(
      mockEventPublisher.object()
    );

    const result = await eventAntiCorruptionLayer.processOrderCreatedEvent({
      productId: "",
    });

    expect(result).toBe(false);

    mockEventPublisher.verify(
      (instance) =>
        instance.publish(
          It.Is((param: ProductAddedEvent) => param.productId === testId)
        ),
      Times.Never()
    );
  });

  it("when-input-event-is-different-schema-should-not-publish", async () => {
    const testId = "test-id";

    const mockEventPublisher = new Mock<PrivateEventPublisher>()
      .setup((instance) =>
        instance.publish(
          It.Is((value: ProductAddedEvent) => value.productId === testId)
        )
      )
      .returnsAsync(true);

    const eventAntiCorruptionLayer = new EventAntiCorruptionLayer(
      mockEventPublisher.object()
    );

    const testEvt: OrderCreatedEventV1 = JSON.parse('{"product_id": "test"}');

    const result = await eventAntiCorruptionLayer.processOrderCreatedEvent(
      testEvt
    );

    expect(result).toBe(false);

    mockEventPublisher.verify(
      (instance) =>
        instance.publish(
          It.Is((param: ProductAddedEvent) => param.productId === testId)
        ),
      Times.Never()
    );
  });
});
