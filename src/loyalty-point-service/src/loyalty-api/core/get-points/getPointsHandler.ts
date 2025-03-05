//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { tracer } from "dd-trace";
import { HandlerResponse } from "../handlerResponse";
import { LoyaltyPointsDTO } from "../loyaltyPointsDTO";
import { loyaltyPointRepository } from "../loyaltyPointRepository";
import { Logger } from "@aws-lambda-powertools/logger";

export class GetProductQuery {
  userId: string;
}

const logger = new Logger({});

export class GetProductHandler {
  private repository: loyaltyPointRepository;

  constructor(repository: loyaltyPointRepository) {
    this.repository = repository;
  }

  public async handle(
    query: GetProductQuery
  ): Promise<HandlerResponse<LoyaltyPointsDTO>> {
    try {
      const span = tracer.scope().active()!;

      const loyaltyAccount = await this.repository.forUser(query.userId);

      if (loyaltyAccount === undefined) {
        span.addTags({'loyalty.notFound': true});
        return {
          data: undefined,
          success: false,
          message: ["Not found"],
        };
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
