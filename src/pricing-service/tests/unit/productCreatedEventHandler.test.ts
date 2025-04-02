//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { ProductCreatedEventHandler, ProductCreatedEvent } from "../../src/pricing-api/core/productCreatedEventHandler";
import { PricingService, PricingResult } from "../../src/pricing-api/core/pricingService";
import { EventPublisher } from "../../src/pricing-api/core/eventPublisher";
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

describe("ProductCreatedEventHandler", () => {
  let mockPricingService: jest.Mocked<PricingService>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;
  let productCreatedEventHandler: ProductCreatedEventHandler;
  let mockActiveSpan: { addTags: jest.Mock };

  beforeEach(() => {
    // Create mocks for dependencies
    mockPricingService = {
      calculate: jest.fn(),
      issueSimulator: jest.fn()
    } as unknown as jest.Mocked<PricingService>;

    mockEventPublisher = {
      publishPriceCalculatedEvent: jest.fn().mockResolvedValue(true)
    } as unknown as jest.Mocked<EventPublisher>;

    mockActiveSpan = { addTags: jest.fn() };
    require("dd-trace").tracer.scope().active.mockReturnValue(mockActiveSpan);

    // Create the handler with mocked dependencies
    productCreatedEventHandler = new ProductCreatedEventHandler(
      mockPricingService,
      mockEventPublisher
    );
  });

  describe("handle", () => {
    it("should calculate pricing and publish an event", async () => {
      // Arrange
      const event: ProductCreatedEvent = {
        productId: "PROD123",
        name: "Test Product",
        price: 29.99
      };

      const calculatedPrices: PricingResult[] = [
        { quantityToOrder: 5, price: 28.49 },
        { quantityToOrder: 10, price: 26.99 }
      ];

      mockPricingService.calculate.mockResolvedValue(calculatedPrices);

      // Act
      await productCreatedEventHandler.handle(event);

      // Assert
      expect(mockActiveSpan.addTags).toHaveBeenCalledWith({
        "product.id": "PROD123",
        "pricing.newPrice": 29.99
      });

      expect(mockPricingService.calculate).toHaveBeenCalledWith({
        productId: "PROD123",
        price: 29.99
      });

      const expectedPublishedEvent: PriceCalculatedEventV1 = {
        productId: "PROD123",
        priceBrackets: [
          { quantity: 5, price: 28.49 },
          { quantity: 10, price: 26.99 }
        ]
      };

      expect(mockEventPublisher.publishPriceCalculatedEvent).toHaveBeenCalledWith(
        expectedPublishedEvent
      );
    });

    it("should handle the case when no active span is available", async () => {
      // Arrange
      const event: ProductCreatedEvent = {
        productId: "PROD123",
        name: "Test Product",
        price: 29.99
      };

      const calculatedPrices: PricingResult[] = [
        { quantityToOrder: 5, price: 28.49 }
      ];

      mockPricingService.calculate.mockResolvedValue(calculatedPrices);
      
      // Mock that there's no active span
      require("dd-trace").tracer.scope().active.mockReturnValue(null);

      // Act
      await productCreatedEventHandler.handle(event);

      // Assert
      expect(mockActiveSpan.addTags).not.toHaveBeenCalled();
      expect(mockPricingService.calculate).toHaveBeenCalledWith({
        productId: "PROD123",
        price: 29.99
      });
      expect(mockEventPublisher.publishPriceCalculatedEvent).toHaveBeenCalled();
    });

    it("should handle errors from the pricing service", async () => {
      // Arrange
      const event: ProductCreatedEvent = {
        productId: "PROD123",
        name: "Test Product",
        price: 92 // This should cause an error
      };

      const errorMessage = "Failure generating prices";
      mockPricingService.calculate.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(productCreatedEventHandler.handle(event)).rejects.toThrow(errorMessage);
      expect(mockPricingService.calculate).toHaveBeenCalled();
      expect(mockEventPublisher.publishPriceCalculatedEvent).not.toHaveBeenCalled();
    });

    it("should map pricing results correctly to price brackets", async () => {
      // Arrange
      const event: ProductCreatedEvent = {
        productId: "PROD123",
        name: "Test Product",
        price: 100
      };

      const calculatedPrices: PricingResult[] = [
        { quantityToOrder: 5, price: 95 },
        { quantityToOrder: 10, price: 90 },
        { quantityToOrder: 25, price: 80 },
        { quantityToOrder: 50, price: 75 },
        { quantityToOrder: 100, price: 70 }
      ];

      mockPricingService.calculate.mockResolvedValue(calculatedPrices);

      // Act
      await productCreatedEventHandler.handle(event);

      // Assert
      const expectedPriceBrackets = [
        { quantity: 5, price: 95 },
        { quantity: 10, price: 90 },
        { quantity: 25, price: 80 },
        { quantity: 50, price: 75 },
        { quantity: 100, price: 70 }
      ];

      expect(mockEventPublisher.publishPriceCalculatedEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: "PROD123",
          priceBrackets: expectedPriceBrackets
        })
      );
    });
  });
}); 