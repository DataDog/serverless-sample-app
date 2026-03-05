//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { handler } from "../../src/pricing-api/adapters/calculatePricingFunction";

jest.mock("dd-trace", () => ({
  tracer: {
    scope: jest.fn().mockReturnValue({
      active: jest.fn().mockReturnValue({
        addTags: jest.fn(),
        finish: jest.fn(),
      }),
    }),
  },
}));

jest.mock("@aws-lambda-powertools/logger", () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock("timers/promises", () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));

const createMockEvent = (body?: any): APIGatewayProxyEventV2 => ({
  version: "2.0",
  routeKey: "POST /pricing",
  rawPath: "/pricing",
  rawQueryString: "",
  headers: { "Content-Type": "application/json" },
  requestContext: {
    accountId: "123456789012",
    apiId: "api-id",
    domainName: "domain-name",
    domainPrefix: "domain-prefix",
    http: {
      method: "POST",
      path: "/pricing",
      protocol: "HTTP/1.1",
      sourceIp: "192.168.0.1",
      userAgent: "agent",
    },
    requestId: "request-id",
    routeKey: "POST /pricing",
    stage: "$default",
    time: "01/Jan/2023:00:00:00 +0000",
    timeEpoch: 1640995200000,
  },
  body: body !== undefined ? JSON.stringify(body) : undefined,
  isBase64Encoded: false,
});

describe("calculatePricingFunction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 with pricing brackets for a valid request", async () => {
    const event = createMockEvent({ name: "TEST123", price: 10 });

    const result = (await handler(event)) as APIGatewayProxyResultV2 & {
      statusCode: number;
      body: string;
    };

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(5);
    expect(body[0]).toHaveProperty("quantityToOrder");
    expect(body[0]).toHaveProperty("price");
  });

  it("should return 400 when price is missing", async () => {
    const event = createMockEvent({ name: "TEST123" });

    const result = (await handler(event)) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(400);
  });

  it("should return 400 when body is missing", async () => {
    const event = createMockEvent();

    const result = (await handler(event)) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(400);
  });

  it("should return 500 for invalid JSON body", async () => {
    const event: APIGatewayProxyEventV2 = {
      ...createMockEvent(),
      body: "{ invalid json",
    };

    const result = (await handler(event)) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(500);
  });

  it("should return 500 for a negative price", async () => {
    const event = createMockEvent({ name: "TEST123", price: -50 });

    const result = (await handler(event)) as { statusCode: number; body: string };

    expect(result.statusCode).toBe(500);
  });

  it("should return correct CORS headers", async () => {
    const event = createMockEvent({ name: "TEST123", price: 10 });

    const result = (await handler(event)) as { statusCode: number; headers: Record<string, string> };

    expect(result.headers).toMatchObject({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST,GET,PUT,DELETE",
    });
  });
});
