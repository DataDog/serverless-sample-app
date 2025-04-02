// 
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SQSEvent, SQSRecord } from "aws-lambda";
import { ProductUpdatedEvent, ProductUpdatedEventHandler } from "../../src/pricing-api/core/productUpdatedEventHandler";
import { handler } from "../../src/pricing-api/adapters/productUpdatedPricingHandler";
import { PricingService } from "../../src/pricing-api/core/pricingService";

// Mock dependencies
jest.mock("@aws-sdk/client-eventbridge", () => {
  return {
    EventBridgeClient: jest.fn().mockImplementation(() => {
      return {};
    }),
  };
});

jest.mock("dd-trace", () => {
  return {
    tracer: {
      scope: jest.fn().mockReturnValue({
        active: jest.fn().mockReturnValue({
          addTags: jest.fn(),
        }),
      }),
      startSpan: jest.fn(),
    },
    Span: jest.fn().mockImplementation(() => {
      return {
        finish: jest.fn(),
        logEvent: jest.fn(),
      };
    }),
  };
});

jest.mock("../../src/pricing-api/adapters/eventBridgeEventPublisher", () => {
  return {
    EventBridgeEventPublisher: jest.fn().mockImplementation(() => {
      return {
        publishPriceCalculatedEvent: jest.fn(),
      };
    }),
  };
});

describe("productUpdatedPricingHandler", () => {
  let mockSQSEvent: SQSEvent;
  let mockProductUpdatedEvent: ProductUpdatedEvent;
  let mockCloudEvent: any;
  let mockEventBridgeEvent: any;
  let productUpdatedHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock product event
    mockProductUpdatedEvent = {
      productId: "PROD123",
      previous: {
        name: "Old Product Name",
        price: 29.99
      },
      new: {
        name: "New Product Name",
        price: 39.99
      }
    };

    // Setup mock CloudEvent
    mockCloudEvent = {
      id: "event-id",
      source: "test-source",
      type: "product.productUpdated.v1",
      data: mockProductUpdatedEvent,
      specversion: "1.0",
      time: new Date().toISOString(),
      datacontenttype: "application/json"
    };

    // Setup mock EventBridge event
    mockEventBridgeEvent = {
      version: "0",
      id: "event-id",
      "detail-type": "product.productUpdated.v1",
      source: "product-service",
      account: "123456789012",
      time: new Date().toISOString(),
      region: "eu-west-1",
      detail: mockCloudEvent
    };

    // Setup mock SQS record
    const mockSQSRecord: SQSRecord = {
      messageId: "message-id",
      receiptHandle: "receipt-handle",
      body: JSON.stringify(mockEventBridgeEvent),
      attributes: {
        ApproximateReceiveCount: "1",
        SentTimestamp: "1234567890",
        SenderId: "sender-id",
        ApproximateFirstReceiveTimestamp: "1234567890"
      },
      messageAttributes: {},
      md5OfBody: "md5-of-body",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:eu-west-1:123456789012:test-queue",
      awsRegion: "eu-west-1"
    };

    // Setup mock SQS event
    mockSQSEvent = {
      Records: [mockSQSRecord]
    };

    // Get reference to mock handler
    const mockEventPublisher = require("../../src/pricing-api/adapters/eventBridgeEventPublisher").EventBridgeEventPublisher();
    productUpdatedHandler = new ProductUpdatedEventHandler(
      new PricingService(),
      mockEventPublisher
    );
  });

  it("should process a valid SQS event with a ProductUpdated event", async () => {
    // Act
    const result = await handler(mockSQSEvent);

    // Assert
    expect(result.batchItemFailures).toEqual([]);
  });

  it("should handle multiple records in a batch", async () => {
    // Arrange
    const secondEvent = { ...mockEventBridgeEvent };
    const secondRecord = { ...mockSQSEvent.Records[0], messageId: "message-id-2", body: JSON.stringify(secondEvent) };
    mockSQSEvent.Records.push(secondRecord);

    // Act
    const result = await handler(mockSQSEvent);

    // Assert
    expect(result.batchItemFailures).toEqual([]);
  });

  it("should handle malformed JSON in the SQS message body", async () => {
    // Arrange
    mockSQSEvent.Records[0].body = "{ invalid json";

    // Act
    const result = await handler(mockSQSEvent);

    // Assert
    // In the actual implementation, errors are properly caught and reported as batch failures
    expect(result.batchItemFailures).toEqual([
      { itemIdentifier: "message-id" }
    ]);
  });

  it("should handle missing data in the CloudEvent", async () => {
    // Arrange
    mockCloudEvent.data = undefined;
    mockSQSEvent.Records[0].body = JSON.stringify(mockEventBridgeEvent);

    // Act
    const result = await handler(mockSQSEvent);

    // Assert
    // In the actual implementation, errors are properly caught and reported as batch failures
    expect(result.batchItemFailures).toEqual([
      { itemIdentifier: "message-id" }
    ]);
  });

  it("should handle missing productId in the ProductUpdatedEvent", async () => {
    // Arrange
    mockProductUpdatedEvent = {
      previous: {
        name: "Old Product Name",
        price: 29.99
      },
      new: {
        name: "New Product Name",
        price: 39.99
      }
    } as ProductUpdatedEvent;
    mockCloudEvent.data = mockProductUpdatedEvent;
    mockSQSEvent.Records[0].body = JSON.stringify(mockEventBridgeEvent);

    // Act
    const result = await handler(mockSQSEvent);

    // Assert
    // In the actual implementation, errors are properly caught and reported as batch failures
    expect(result.batchItemFailures).toEqual([
      { itemIdentifier: "message-id" }
    ]);
  });

  it("should handle missing previous price in the ProductUpdatedEvent", async () => {
    // Arrange
    mockProductUpdatedEvent = {
      productId: "PROD123",
      previous: {
        name: "Old Product Name"
      } as any,
      new: {
        name: "New Product Name",
        price: 39.99
      }
    };
    mockCloudEvent.data = mockProductUpdatedEvent;
    mockSQSEvent.Records[0].body = JSON.stringify(mockEventBridgeEvent);

    // Act
    const result = await handler(mockSQSEvent);

    // Assert
    expect(result.batchItemFailures.length).toEqual(1);
  });

  it("should handle missing new price in the ProductUpdatedEvent", async () => {
    // Arrange
    mockProductUpdatedEvent = {
      productId: "PROD123",
      previous: {
        name: "Old Product Name",
        price: 29.99
      },
      new: {
        name: "New Product Name"
      } as any
    };
    mockCloudEvent.data = mockProductUpdatedEvent;
    mockSQSEvent.Records[0].body = JSON.stringify(mockEventBridgeEvent);

    // Act
    const result = await handler(mockSQSEvent);

    // Assert
    expect(result.batchItemFailures.length).toEqual(1);
  });

  it("should handle completely missing previous field in the ProductUpdatedEvent", async () => {
    // Arrange
    mockProductUpdatedEvent = {
      productId: "PROD123",
      new: {
        name: "New Product Name",
        price: 39.99
      }
    } as ProductUpdatedEvent;
    mockCloudEvent.data = mockProductUpdatedEvent;
    mockSQSEvent.Records[0].body = JSON.stringify(mockEventBridgeEvent);

    // Act
    const result = await handler(mockSQSEvent);

    // Assert
    expect(result.batchItemFailures.length).toEqual(1);
  });

  it("should handle completely missing new field in the ProductUpdatedEvent", async () => {
    // Arrange
    mockProductUpdatedEvent = {
      productId: "PROD123",
      previous: {
        name: "Old Product Name",
        price: 29.99
      }
    } as ProductUpdatedEvent;
    mockCloudEvent.data = mockProductUpdatedEvent;
    mockSQSEvent.Records[0].body = JSON.stringify(mockEventBridgeEvent);

    // Act
    const result = await handler(mockSQSEvent);

    // Assert
    expect(result.batchItemFailures.length).toEqual(1);
  });

  it("should handle unexpected event structure", async () => {
    // Arrange
    mockSQSEvent.Records[0].body = JSON.stringify({ 
      version: "0",
      id: "event-id",
      "detail-type": "some.other.event",
      source: "product-service",
      detail: { some: "unexpected data" }
    });

    // Act
    const result = await handler(mockSQSEvent);

    // Assert
    // In the actual implementation, errors are properly caught and reported as batch failures
    expect(result.batchItemFailures).toEqual([
      { itemIdentifier: "message-id" }
    ]);
  });

  it("should handle null event records gracefully", async () => {
    // Arrange
    mockSQSEvent.Records = [];

    // Act
    const result = await handler(mockSQSEvent);

    // Assert
    expect(result.batchItemFailures).toEqual([]);
  });
}); 