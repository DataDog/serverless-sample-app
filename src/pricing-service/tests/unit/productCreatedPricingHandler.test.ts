//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SQSEvent, SQSRecord } from "aws-lambda";
import { ProductCreatedEvent } from "../../src/pricing-api/core/productCreatedEventHandler";
import { handler } from "../../src/pricing-api/adapters/productCreatedPricingHandler";

// Mock dependencies
jest.mock("@aws-sdk/client-eventbridge", () => ({
  EventBridgeClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: jest.fn().mockImplementation(() => ({})),
  GetParameterCommand: jest.fn(),
}));

jest.mock("../../src/pricing-api/adapters/ssmProductApiClient", () => ({
  SsmProductApiClient: jest.fn().mockImplementation(() => ({
    getProductPrice: jest.fn().mockResolvedValue(29.99),
  })),
}));

jest.mock("dd-trace", () => ({
  tracer: {
    scope: jest.fn().mockReturnValue({
      active: jest.fn().mockReturnValue({
        addTags: jest.fn(),
        addLink: jest.fn(),
      }),
    }),
    startSpan: jest.fn().mockReturnValue({
      addTags: jest.fn(),
      addLink: jest.fn(),
      finish: jest.fn(),
    }),
    dataStreamsCheckpointer: {
      setConsumeCheckpoint: jest.fn(),
      setProduceCheckpoint: jest.fn(),
    },
  },
  Span: jest.fn().mockImplementation(() => ({
    finish: jest.fn(),
    logEvent: jest.fn(),
  })),
}));

jest.mock("../../src/pricing-api/adapters/eventBridgeEventPublisher", () => ({
  EventBridgeEventPublisher: jest.fn().mockImplementation(() => ({
    publishPriceCalculatedEvent: jest.fn(),
  })),
}));

describe("productCreatedPricingHandler", () => {
  let mockSQSEvent: SQSEvent;
  let mockCloudEvent: any;
  let mockEventBridgeEvent: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockProductCreatedEvent: ProductCreatedEvent = { productId: "PROD123" };

    mockCloudEvent = {
      id: "event-id",
      source: "test-source",
      type: "product.productCreated.v1",
      data: mockProductCreatedEvent,
      specversion: "1.0",
      time: new Date().toISOString(),
      datacontenttype: "application/json",
    };

    mockEventBridgeEvent = {
      version: "0",
      id: "event-id",
      "detail-type": "product.productCreated.v1",
      source: "product-service",
      account: "123456789012",
      time: new Date().toISOString(),
      region: "eu-west-1",
      detail: mockCloudEvent,
    };

    const mockSQSRecord: SQSRecord = {
      messageId: "message-id",
      receiptHandle: "receipt-handle",
      body: JSON.stringify(mockEventBridgeEvent),
      attributes: {
        ApproximateReceiveCount: "1",
        SentTimestamp: "1234567890",
        SenderId: "sender-id",
        ApproximateFirstReceiveTimestamp: "1234567890",
      },
      messageAttributes: {},
      md5OfBody: "md5-of-body",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:eu-west-1:123456789012:test-queue",
      awsRegion: "eu-west-1",
    };

    mockSQSEvent = { Records: [mockSQSRecord] };
  });

  it("should process a valid SQS event with a ProductCreated event", async () => {
    const result = await handler(mockSQSEvent);
    expect(result.batchItemFailures).toEqual([]);
  });

  it("should handle multiple records in a batch", async () => {
    const secondRecord = {
      ...mockSQSEvent.Records[0],
      messageId: "message-id-2",
      body: JSON.stringify(mockEventBridgeEvent),
    };
    mockSQSEvent.Records.push(secondRecord);

    const result = await handler(mockSQSEvent);
    expect(result.batchItemFailures).toEqual([]);
  });

  it("should handle malformed JSON in the SQS message body", async () => {
    mockSQSEvent.Records[0].body = "{ invalid json";

    const result = await handler(mockSQSEvent);
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "message-id" }]);
  });

  it("should handle missing data in the CloudEvent", async () => {
    mockCloudEvent.data = undefined;
    mockSQSEvent.Records[0].body = JSON.stringify(mockEventBridgeEvent);

    const result = await handler(mockSQSEvent);
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "message-id" }]);
  });

  it("should handle unexpected event structure", async () => {
    mockSQSEvent.Records[0].body = JSON.stringify({
      version: "0",
      id: "event-id",
      "detail-type": "some.other.event",
      source: "product-service",
      detail: { some: "unexpected data" },
    });

    const result = await handler(mockSQSEvent);
    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "message-id" }]);
  });

  it("should handle null event records gracefully", async () => {
    mockSQSEvent.Records = [];

    const result = await handler(mockSQSEvent);
    expect(result.batchItemFailures).toEqual([]);
  });
});
