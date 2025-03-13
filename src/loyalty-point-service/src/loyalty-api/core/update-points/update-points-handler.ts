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
import { EventPublisher } from "../eventPublisher";

export class UpdatePointsCommand {
  userId: string;
  orderNumber: string;
  pointsToAdd: number;
}

const logger = new Logger({});

export class UpdatePointsCommandHandler {
  private repository: loyaltyPointRepository;
  private eventPublisher: EventPublisher;

  constructor(
    repository: loyaltyPointRepository,
    eventPublisher: EventPublisher
  ) {
    this.repository = repository;
  }

  public async handle(
    command: UpdatePointsCommand
  ): Promise<HandlerResponse<LoyaltyPointsDTO>> {
    try {
      const span = tracer.scope().active()!;
      span.addTags({
        "user.id": command.userId,
      });
      span.addTags({
        "order.id": command.orderNumber,
      });

      let loyaltyAccount = await this.repository.forUser(command.userId);

      if (loyaltyAccount === undefined) {
        span.addTags({ "loyalty.newAccount": true });
        loyaltyAccount = new LoyaltyPoints(command.userId, 0, []);
      }

      var pointsAdded = loyaltyAccount.addPoints(
        command.orderNumber,
        command.pointsToAdd
      );

      if (pointsAdded) {
        await this.repository.save(loyaltyAccount);
        await this.eventPublisher.publishLoyaltyPointsUpdated({
          userId: loyaltyAccount.userId,
          newPointsTotal: loyaltyAccount.currentPoints,
        });
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
      return {
        data: undefined,
        success: false,
        message: ["Unknown error"],
      };
    }
  }
}
