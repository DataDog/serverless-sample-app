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

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    pricingService = new PricingService();
    mockSetTimeout = require("timers/promises").setTimeout as jest.Mock;
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
  });

  describe("issueSimulator", () => {
    it("should add a delay for prices between 95 and 100", async () => {
      // Arrange
      const price = 97;
      
      // Act
      await pricingService.issueSimulator(price);
      
      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(8000);
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
    });
  });

  describe("integration of calculate and issueSimulator", () => {
    it("should throw an error when price is between 90 and 95", async () => {
      // Arrange
      const command: CalculatePricingCommand = {
        productId: "TEST123",
        price: 92
      };
      
      // Act & Assert
      await expect(pricingService.calculate(command)).rejects.toThrow(
        "Failure generating prices, pricing cannot be calculated for products between 90 & 95"
      );
    });

    it("should add delay but complete successfully for prices between 95 and 100", async () => {
      // Arrange
      const command: CalculatePricingCommand = {
        productId: "TEST123",
        price: 97
      };
      
      // Act
      const result = await pricingService.calculate(command);
      
      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(8000);
      expect(result).toHaveLength(5);
      expect(result[0].price).toBe(92.15); // 97 * 0.95 = 92.15
    });

    it("should add a long delay but complete successfully for prices between 50 and 60", async () => {
      // Arrange
      const command: CalculatePricingCommand = {
        productId: "TEST123",
        price: 55
      };
      
      // Act
      const result = await pricingService.calculate(command);
      
      // Assert
      expect(mockSetTimeout).toHaveBeenCalledWith(40000);
      expect(result).toHaveLength(5);
      expect(result[0].price).toBe(52.25); // 55 * 0.95 = 52.25
    });
  });
}); 