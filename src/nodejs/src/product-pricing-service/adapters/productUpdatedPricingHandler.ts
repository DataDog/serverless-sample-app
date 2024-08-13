//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SNSClient } from "@aws-sdk/client-sns";
import { SNSEvent, SQSEvent } from "aws-lambda";
import { tracer } from "dd-trace";
import { PricingService } from "../core/pricingService";
import { SnsEventPublisher } from "./snsEventPublisher";
import {
  ProductUpdatedEvent,
  ProductUpdatedEventHandler,
} from "../core/productUpdatedEventHandler";
import { Logger } from "@aws-lambda-powertools/logger";
const logger = new Logger({ serviceName: process.env.DD_SERVICE });
const snsClient = new SNSClient();

const updateProductHandler = new ProductUpdatedEventHandler(
  new PricingService(),
  new SnsEventPublisher(snsClient)
);

export const handler = async (event: SNSEvent): Promise<string> => {
  const mainSpan = tracer.scope().active();

  logger.info("Handling pricing updated event from SNS");

  for (const message of event.Records) {
    try {
      logger.info("Processing message:");
      logger.info(message.Sns.Message);

      const data: ProductUpdatedEvent = JSON.parse(message.Sns.Message);

      await updateProductHandler.handle(data);

      logger.info("Processing complete");
    } catch (error) {
      logger.error(JSON.stringify(error));
      throw error;
    }
  }

  return "OK";
};
