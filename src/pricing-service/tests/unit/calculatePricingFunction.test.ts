// 
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { handler } from "../../src/pricing-api/adapters/calculatePricingFunction";

// Create a mock for APIGatewayProxyEventV2
const createMockEvent = (body?: any): APIGatewayProxyEventV2 => {
  return {
    version: '2.0',
    routeKey: 'POST /pricing',
    rawPath: '/pricing',
    rawQueryString: '',
    headers: {
      'Content-Type': 'application/json'
    },
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'domain-name',
      domainPrefix: 'domain-prefix',
      http: {
        method: 'POST',
        path: '/pricing',
        protocol: 'HTTP/1.1',
        sourceIp: '192.168.0.1',
        userAgent: 'agent'
      },
      requestId: 'request-id',
      routeKey: 'POST /pricing',
      stage: '$default',
      time: '01/Jan/2023:00:00:00 +0000',
      timeEpoch: 1640995200000
    },
    body: body ? JSON.stringify(body) : undefined,
    isBase64Encoded: false
  };
};

describe("calculatePricingFunction", () => {
  describe("handler", () => {
    it("should return a 200 status code", async () => {
      // Arrange
      const event = createMockEvent({ productId: "TEST123", price: 100 });

      // Act
      const result = await handler(event);
      const typedResult = result as {
        statusCode: number;
        body: string;
        headers: Record<string, string>;
      };

      // Assert
      expect(typedResult.statusCode).toBe(200);
    });

    it("should return the correct headers", async () => {
      // Arrange
      const event = createMockEvent({ productId: "TEST123", price: 100 });

      // Act
      const result = await handler(event);
      const typedResult = result as {
        statusCode: number;
        body: string;
        headers: Record<string, string>;
      };

      // Assert
      expect(typedResult.headers).toEqual({
        "Content-Type": "application-json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST,GET,PUT,DELETE",
      });
    });

    it("should handle missing request body", async () => {
      // Arrange
      const event = createMockEvent();

      // Act
      const result = await handler(event);
      const typedResult = result as {
        statusCode: number;
        body: string;
        headers: Record<string, string>;
      };

      // Assert
      expect(typedResult.statusCode).toBe(200);
      expect(typedResult.body).toBe(JSON.stringify('OK'));
    });

    it("should handle invalid JSON in the request body", async () => {
      // Arrange
      const invalidJsonEvent: APIGatewayProxyEventV2 = {
        ...createMockEvent(),
        body: "{ invalid json"
      };

      // Act
      const result = await handler(invalidJsonEvent);
      const typedResult = result as {
        statusCode: number;
        body: string;
        headers: Record<string, string>;
      };

      // Assert
      expect(typedResult.statusCode).toBe(200);
      expect(typedResult.body).toBe(JSON.stringify('OK'));
    });

    it("should handle missing productId", async () => {
      // Arrange
      const event = createMockEvent({ price: 100 });

      // Act
      const result = await handler(event);
      const typedResult = result as {
        statusCode: number;
        body: string;
        headers: Record<string, string>;
      };

      // Assert
      expect(typedResult.statusCode).toBe(200);
      expect(typedResult.body).toBe(JSON.stringify('OK'));
    });

    it("should handle missing price", async () => {
      // Arrange
      const event = createMockEvent({ productId: "TEST123" });

      // Act
      const result = await handler(event);
      const typedResult = result as {
        statusCode: number;
        body: string;
        headers: Record<string, string>;
      };

      // Assert
      expect(typedResult.statusCode).toBe(200);
      expect(typedResult.body).toBe(JSON.stringify('OK'));
    });

    it("should handle invalid price type", async () => {
      // Arrange
      const event = createMockEvent({ productId: "TEST123", price: "not-a-number" });

      // Act
      const result = await handler(event);
      const typedResult = result as {
        statusCode: number;
        body: string;
        headers: Record<string, string>;
      };

      // Assert
      expect(typedResult.statusCode).toBe(200);
      expect(typedResult.body).toBe(JSON.stringify('OK'));
    });

    it("should handle negative price values", async () => {
      // Arrange
      const event = createMockEvent({ productId: "TEST123", price: -50 });

      // Act
      const result = await handler(event);
      const typedResult = result as {
        statusCode: number;
        body: string;
        headers: Record<string, string>;
      };

      // Assert
      expect(typedResult.statusCode).toBe(200);
      expect(typedResult.body).toBe(JSON.stringify('OK'));
    });

    it("should handle empty productId", async () => {
      // Arrange
      const event = createMockEvent({ productId: "", price: 100 });

      // Act
      const result = await handler(event);
      const typedResult = result as {
        statusCode: number;
        body: string;
        headers: Record<string, string>;
      };

      // Assert
      expect(typedResult.statusCode).toBe(200);
      expect(typedResult.body).toBe(JSON.stringify('OK'));
    });
  });
}); 