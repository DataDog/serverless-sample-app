//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { HandlerResponse } from "../handlerResponse";
import { LoyaltyPointsDTO } from "../loyaltyPointsDTO";
import { Logger } from "@aws-lambda-powertools/logger";
import { loyaltyPointRepository } from "../loyaltyPointRepository";
import { EventPublisher } from "../eventPublisher";

export class SpendPointsCommand {
  userId: string;
  points: number;
}

const logger = new Logger({});

export class SpendPointsCommandHandler {
  private repository: loyaltyPointRepository;

  constructor(
    repository: loyaltyPointRepository,
  ) {
    this.repository = repository;
  }

  public async handle(
    query: SpendPointsCommand
  ): Promise<HandlerResponse<LoyaltyPointsDTO>> {
    try {
      const span = tracer.scope().active()!;

      const loyaltyAccount = await this.repository.forUser(query.userId);

      if (loyaltyAccount === undefined) {
        span.addTags({ "loyalty.notFound": true });
        return {
          data: undefined,
          success: false,
          message: ["Not found"],
        };
      }

      const spendResult = loyaltyAccount.spendPoints(query.points);

      if (!spendResult) {
        return {
          data: {
            userId: loyaltyAccount.userId,
            currentPoints: loyaltyAccount.currentPoints,
          },
          success: false,
          message: ["You don't have enough points"],
        };
      }

      await this.repository.save(loyaltyAccount);

      return {
        data: {
          userId: loyaltyAccount.userId,
          currentPoints: loyaltyAccount.currentPoints,
        },
        success: true,
        message: [],
      };
    } catch (error) {
      return {
        data: undefined,
        success: false,
        message: ["Unknown error"],
      };
    }
  }
}
