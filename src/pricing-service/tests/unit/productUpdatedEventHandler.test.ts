//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ProductUpdatedEventHandler, ProductUpdatedEvent } from "../../src/pricing-api/core/productUpdatedEventHandler";
import { PricingService, PricingResult } from "../../src/pricing-api/core/pricingService";
import { EventPublisher } from "../../src/pricing-api/core/eventPublisher";
import { ProductApiClient } from "../../src/pricing-api/core/productApiClient";
import { PriceCalculatedEventV1 } from "../../src/pricing-api/events/priceCalculatedEventV1";

// Mock dependencies
jest.mock("dd-trace", () => {
  return {
    tracer: {
      scope: jest.fn().mockReturnValue({
        active: jest.fn().mockReturnValue({
          addTags: jest.fn()
        })
      })
    }
  };
});

describe("ProductUpdatedEventHandler", () => {
  let mockPricingService: jest.Mocked<PricingService>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;
  let mockProductApiClient: jest.Mocked<ProductApiClient>;
  let productUpdatedEventHandler: ProductUpdatedEventHandler;
  let mockActiveSpan: { addTags: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPricingService = {
      calculate: jest.fn(),
      issueSimulator: jest.fn()
    } as unknown as jest.Mocked<PricingService>;

    mockEventPublisher = {
      publishPriceCalculatedEvent: jest.fn().mockResolvedValue(true)
    } as unknown as jest.Mocked<EventPublisher>;

    mockProductApiClient = {
      getProductPrice: jest.fn().mockResolvedValue(39.99)
    } as unknown as jest.Mocked<ProductApiClient>;

    mockActiveSpan = { addTags: jest.fn() };
    require("dd-trace").tracer.scope().active.mockReturnValue(mockActiveSpan);

    productUpdatedEventHandler = new ProductUpdatedEventHandler(
      mockPricingService,
      mockEventPublisher,
      mockProductApiClient
    );
  });

  describe("handle", () => {
    it("should fetch product price and calculate pricing and publish an event", async () => {
      // Arrange
      const event: ProductUpdatedEvent = { productId: "PROD123" };

      const calculatedPrices: PricingResult[] = [
        { quantityToOrder: 5, price: 37.99 },
        { quantityToOrder: 10, price: 35.99 }
      ];

      mockProductApiClient.getProductPrice.mockResolvedValue(39.99);
      mockPricingService.calculate.mockResolvedValue(calculatedPrices);

      // Act
      await productUpdatedEventHandler.handle(event);

      // Assert
      expect(mockProductApiClient.getProductPrice).toHaveBeenCalledWith("PROD123");
      expect(mockActiveSpan.addTags).toHaveBeenCalledWith({ "product.id": "PROD123" });
      expect(mockActiveSpan.addTags).toHaveBeenCalledWith({ "pricing.price": 39.99 });
      expect(mockPricingService.calculate).toHaveBeenCalledWith({ productId: "PROD123", price: 39.99 });

      const expectedPublishedEvent: PriceCalculatedEventV1 = {
        productId: "PROD123",
        priceBrackets: [
          { quantity: 5, price: 37.99 },
          { quantity: 10, price: 35.99 }
        ]
      };
      expect(mockEventPublisher.publishPriceCalculatedEvent).toHaveBeenCalledWith(expectedPublishedEvent, undefined);
    });

    it("should handle the case when no active span is available", async () => {
      // Arrange
      const event: ProductUpdatedEvent = { productId: "PROD123" };

      mockProductApiClient.getProductPrice.mockResolvedValue(39.99);
      mockPricingService.calculate.mockResolvedValue([{ quantityToOrder: 5, price: 37.99 }]);
      require("dd-trace").tracer.scope().active.mockReturnValue(null);

      // Act
      await productUpdatedEventHandler.handle(event);

      // Assert
      expect(mockActiveSpan.addTags).not.toHaveBeenCalled();
      expect(mockPricingService.calculate).toHaveBeenCalled();
      expect(mockEventPublisher.publishPriceCalculatedEvent).toHaveBeenCalled();
    });

    it("should propagate errors from the product API client", async () => {
      // Arrange
      const event: ProductUpdatedEvent = { productId: "PROD123" };
      mockProductApiClient.getProductPrice.mockRejectedValue(new Error("Product API unavailable"));

      // Act & Assert
      await expect(productUpdatedEventHandler.handle(event)).rejects.toThrow("Product API unavailable");
      expect(mockPricingService.calculate).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishPriceCalculatedEvent).not.toHaveBeenCalled();
    });

    it("should propagate errors from the pricing service", async () => {
      // Arrange
      const event: ProductUpdatedEvent = { productId: "PROD123" };
      mockProductApiClient.getProductPrice.mockResolvedValue(92);
      mockPricingService.calculate.mockRejectedValue(new Error("Failure generating prices"));

      // Act & Assert
      await expect(productUpdatedEventHandler.handle(event)).rejects.toThrow("Failure generating prices");
      expect(mockPricingService.calculate).toHaveBeenCalled();
      expect(mockEventPublisher.publishPriceCalculatedEvent).not.toHaveBeenCalled();
    });

    it("should map pricing results correctly to price brackets", async () => {
      // Arrange
      const event: ProductUpdatedEvent = { productId: "PROD123" };

      mockProductApiClient.getProductPrice.mockResolvedValue(100);
      mockPricingService.calculate.mockResolvedValue([
        { quantityToOrder: 5, price: 95 },
        { quantityToOrder: 10, price: 90 },
        { quantityToOrder: 25, price: 80 },
        { quantityToOrder: 50, price: 75 },
        { quantityToOrder: 100, price: 70 }
      ]);

      // Act
      await productUpdatedEventHandler.handle(event);

      // Assert
      expect(mockEventPublisher.publishPriceCalculatedEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: "PROD123",
          priceBrackets: [
            { quantity: 5, price: 95 },
            { quantity: 10, price: 90 },
            { quantity: 25, price: 80 },
            { quantity: 50, price: 75 },
            { quantity: 100, price: 70 }
          ]
        }),
        undefined
      );
    });
  });
}); 