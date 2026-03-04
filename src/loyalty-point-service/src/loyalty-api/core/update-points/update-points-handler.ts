//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { HandlerResponse } from "../handlerResponse";
import { Logger } from "@aws-lambda-powertools/logger";
import { loyaltyPointRepository } from "../loyaltyPointRepository";
import { LoyaltyPointsDTO } from "../loyaltyPointsDTO";
import { LoyaltyPoints } from "../loyaltyPoints";
import { ConcurrentModificationError } from "../concurrentModificationError";

export class UpdatePointsCommand {
  userId: string;
  orderNumber?: string;
  orderId?: string;
  pointsToAdd: number;
}

const logger = new Logger({});
const MAX_RETRIES = 3;

export class UpdatePointsCommandHandler {
  private repository: loyaltyPointRepository;

  constructor(
    repository: loyaltyPointRepository,
  ) {
    this.repository = repository;
  }

  public async handle(
    command: UpdatePointsCommand
  ): Promise<HandlerResponse<LoyaltyPointsDTO>> {
    const idempotencyKey = command.orderId ?? command.orderNumber;
    if (!idempotencyKey) {
      return {
        data: undefined,
        success: false,
        message: ["Either orderId or orderNumber must be provided"],
      };
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const span = tracer.scope().active();
        span?.addTags({
          "user.id": command.userId,
          "order.id": idempotencyKey,
        });

        let loyaltyAccount = await this.repository.forUser(command.userId);

        if (loyaltyAccount === undefined) {
          span?.addTags({ "loyalty.newAccount": true });
          loyaltyAccount = new LoyaltyPoints(command.userId, 0, []);
        }

        const pointsAdded = loyaltyAccount.addPoints(
          idempotencyKey,
          command.pointsToAdd
        );

        if (pointsAdded) {
          await this.repository.save(loyaltyAccount);
        }

        return {
          data: {
            userId: loyaltyAccount.userId,
            currentPoints: loyaltyAccount.currentPoints,
          },
          success: true,
          message: [],
        };
      } catch (error) {
        if (error instanceof ConcurrentModificationError && attempt < MAX_RETRIES) {
          logger.warn("Concurrent modification, retrying", {
            userId: command.userId,
            attempt: attempt + 1,
          });
          continue;
        }

        logger.error("Failed to update points", { error });
        return {
          data: undefined,
          success: false,
          message: [error instanceof ConcurrentModificationError
            ? "Concurrent modification conflict after retries"
            : "Unknown error"],
        };
      }
    }

    return {
      data: undefined,
      success: false,
      message: ["Unknown error"],
    };
  }
}
