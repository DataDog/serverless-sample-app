//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { LoyaltyPoints } from "../core/loyaltyPoints";
import { ConcurrentModificationError } from "../core/concurrentModificationError";
import { loyaltyPointRepository } from "../core/loyaltyPointRepository";
import { UpdatePointsCommandHandler } from "../core/update-points/update-points-handler";

// Mock dd-trace before importing handler
jest.mock("dd-trace", () => ({
  tracer: {
    scope: () => ({
      active: () => ({
        addTags: jest.fn(),
      }),
    }),
  },
}));

describe("LoyaltyPoints domain model", () => {
  it("addPoints is idempotent for the same order number", () => {
    const account = new LoyaltyPoints("user-1", 100, []);

    const first = account.addPoints("order-1", 50);
    const second = account.addPoints("order-1", 50);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(account.currentPoints).toBe(150);
    expect(account.orders).toEqual(["order-1"]);
  });

  it("addPoints adds different orders independently", () => {
    const account = new LoyaltyPoints("user-1", 100, []);

    account.addPoints("order-1", 50);
    account.addPoints("order-2", 30);

    expect(account.currentPoints).toBe(180);
    expect(account.orders).toEqual(["order-1", "order-2"]);
  });
});

describe("UpdatePointsCommandHandler retry logic", () => {
  it("retries on ConcurrentModificationError and succeeds", async () => {
    let saveCallCount = 0;
    const mockRepo: loyaltyPointRepository = {
      forUser: jest.fn().mockImplementation(async () =>
        new LoyaltyPoints("user-1", 100, [], 1)
      ),
      save: jest.fn().mockImplementation(async () => {
        saveCallCount++;
        if (saveCallCount === 1) {
          throw new ConcurrentModificationError("user-1");
        }
      }),
    };

    const handler = new UpdatePointsCommandHandler(mockRepo);
    const result = await handler.handle({
      userId: "user-1",
      orderNumber: "order-1",
      pointsToAdd: 50,
    });

    expect(result.success).toBe(true);
    expect(result.data?.currentPoints).toBe(150);
    expect(saveCallCount).toBe(2);
  });

  it("fails after exhausting retries on persistent conflicts", async () => {
    const mockRepo: loyaltyPointRepository = {
      forUser: jest.fn().mockImplementation(async () =>
        new LoyaltyPoints("user-1", 100, [], 1)
      ),
      save: jest.fn().mockRejectedValue(new ConcurrentModificationError("user-1")),
    };

    const handler = new UpdatePointsCommandHandler(mockRepo);
    const result = await handler.handle({
      userId: "user-1",
      orderNumber: "order-1",
      pointsToAdd: 50,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Concurrent modification conflict after retries");
    // 1 initial + 3 retries = 4 total save attempts
    expect(mockRepo.save).toHaveBeenCalledTimes(4);
  });

  it("duplicate events produce correct final state", async () => {
    const storedAccount = new LoyaltyPoints("user-1", 100, [], 1);
    const mockRepo: loyaltyPointRepository = {
      forUser: jest.fn().mockResolvedValue(
        // Return a fresh copy each time to simulate re-reading from DB
        new LoyaltyPoints(storedAccount.userId, storedAccount.currentPoints, [...storedAccount.orders], storedAccount.version)
      ),
      save: jest.fn().mockImplementation(async (lp: LoyaltyPoints) => {
        // Simulate the save succeeding and updating stored state
        storedAccount.currentPoints = lp.currentPoints;
        storedAccount.orders = [...lp.orders];
        storedAccount.version = lp.version + 1;
      }),
    };

    const handler = new UpdatePointsCommandHandler(mockRepo);

    // Process the same order event twice
    const result1 = await handler.handle({
      userId: "user-1",
      orderNumber: "order-1",
      pointsToAdd: 50,
    });

    // Update mock to return the new state
    (mockRepo.forUser as jest.Mock).mockResolvedValue(
      new LoyaltyPoints(storedAccount.userId, storedAccount.currentPoints, [...storedAccount.orders], storedAccount.version)
    );

    const result2 = await handler.handle({
      userId: "user-1",
      orderNumber: "order-1",
      pointsToAdd: 50,
    });

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    // Points should only be added once due to order deduplication
    expect(result1.data?.currentPoints).toBe(150);
    expect(result2.data?.currentPoints).toBe(150);
    // save should only be called once (second call is skipped due to dedup)
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });
});
