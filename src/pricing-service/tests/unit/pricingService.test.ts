//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { PricingService, PricingResult } from "../../src/pricing-api/core/pricingService";
import { CalculatePricingCommand } from "../../src/pricing-api/core/calculatePricingCommand";
import { Logger } from "@aws-lambda-powertools/logger";

// Mock the Logger
jest.mock("@aws-lambda-powertools/logger", () => {
  return {
    Logger: jest.fn().mockImplementation(() => {
      return {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
    })
  };
});

// Mock the setTimeout function from timers/promises
jest.mock("timers/promises", () => {
  return {
    setTimeout: jest.fn().mockResolvedValue(undefined)
  };
});

describe("PricingService", () => {
  let pricingService: PricingService;
  let mockSetTimeout: jest.Mock;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    pricingService = new PricingService();
    mockSetTimeout = require("timers/promises").setTimeout as jest.Mock;
    mockLogger = (pricingService as any).logger;
  });

  describe("calculate", () => {
    it("should correctly calculate pricing brackets for a given price", async () => {
      // Arrange
      const command: CalculatePricingCommand = {
        productId: "TEST123",
        price: 100
      };
      
      // Act
      const result = await pricingService.calculate(command);
      
      // Assert
      expect(result).toHaveLength(5);
      expect(result).toEqual([
        { quantityToOrder: 5, price: 95.00 },
        { quantityToOrder: 10, price: 90.00 },
        { quantityToOrder: 25, price: 80.00 },
        { quantityToOrder: 50, price: 75.00 },
        { quantityToOrder: 100, price: 70.00 }
      ]);
    });

    it("should correctly round prices to 2 decimal places", async () => {
      // Arrange
      const command: CalculatePricingCommand = {
        productId: "TEST123",
        price: 10.33
      };
      
      // Act
      const result = await pricingService.calculate(command);
      
      // Assert
      expect(result[0].price).toBe(9.81); // 10.33 * 0.95 = 9.8135, rounded to 9.81
      expect(result[1].price).toBe(9.30); // 10.33 * 0.9 = 9.297, rounded to 9.30
      expect(result[2].price).toBe(8.26); // 10.33 * 0.8 = 8.264, rounded to 8.26
      expect(result[3].price).toBe(7.75); // 10.33 * 0.75 = 7.7475, rounded to 7.75
      expect(result[4].price).toBe(7.23); // 10.33 * 0.7 = 7.231, rounded to 7.23
    });

    it("should handle zero price correctly", async () => {
      // Arrange
      const command: CalculatePricingCommand = {
        productId: "TEST123",
        price: 0
      };
      
      // Act
      const result = await pricingService.calculate(command);
      
      // Assert
      expect(result).toHaveLength(5);
      result.forEach(bracket => {
        expect(bracket.price).toBe(0);
      });
    });

    it("should throw an error for negative prices", async () => {
      // Arrange
      const command: CalculatePricingCommand = {
        productId: "TEST123",
        price: -10
      };
      
      // Act & Assert
      await expect(pricingService.calculate(command)).rejects.toThrow(
        "Price cannot be negative"
      );
    });

    it("should handle very large prices correctly", async () => {
      // Arrange
      const command: CalculatePricingCommand = {
        productId: "TEST123",
        price: 1000000
      };
      
      // Act
      const result = await pricingService.calculate(command);
      
      // Assert
      expect(result).toHaveLength(5);
      expect(result[0].price).toBe(950000); // 1000000 * 0.95 = 950000
      expect(result[4].price).toBe(700000); // 1000000 * 0.7 = 700000
    });
  });

  describe("issueSimulator", () => {
    it("should add a delay for prices between 95 and 100", async () => {
      // Arrange
      const price = 97;
      
      // Act
      await pricingService.issueSimulator(price);
      
      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(8000);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should add a long delay for prices between 50 and 60", async () => {
      // Arrange
      const price = 55;
      
      // Act
      await pricingService.issueSimulator(price);
      
      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(40000);
    });

    it("should throw an error for prices between 90 and 95", async () => {
      // Arrange
      const price = 92;
      
      // Act & Assert
      await expect(pricingService.issueSimulator(price)).rejects.toThrow(
        "Failure generating prices, pricing cannot be calculated for products between 90 & 95"
      );
    });

    it("should not add delays or throw errors for normal prices", async () => {
      // Arrange
      const price = 20;
      
      // Act
      await pricingService.issueSimulator(price);
      
      // Assert
      expect(mockSetTimeout).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it("should handle the exact boundary condition of price = 95", async () => {
      // Arrange
      const price = 95;
      
      // Act
      await pricingService.issueSimulator(price);
      
      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(8000);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should handle the exact boundary condition of price = 90", async () => {
      // Arrange
      const price = 90;
      
      // Act & Assert
      await expect(pricingService.issueSimulator(price)).rejects.toThrow(
        "Failure generating prices, pricing cannot be calculated for products between 90 & 95"
      );
    });
  });

  describe("round2Dp function", () => {
    it("should correctly round to 2 decimal places", () => {
      // Using the PricingService to indirectly test the round2Dp function
      const testCases = [
        { input: 10.3333, expected: 10.33 },
        { input: 10.006, expected: 10.01 },
        { input: 10.005, expected: 10.01 },
        { input: 10.004, expected: 10.00 },
        { input: 10.995, expected: 11.00 },
        { input: 0.001, expected: 0.00 },
        { input: 0.999, expected: 1.00 }
      ];

      testCases.forEach(({ input, expected }) => {
        const command: CalculatePricingCommand = {
          productId: "TEST123",
          price: input / 0.95 // Reverse calculate to get the same result
        };

        // We need to mock the issueSimulator to avoid delays
        jest.spyOn(pricingService, 'issueSimulator').mockResolvedValue();
        
        // Use the calculate method and check the first bracket (5 quantity, 0.95 discount)
        return pricingService.calculate(command).then(results => {
          expect(results[0].price).toBe(expected);
        });
      });
    });
  });
}); 