//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SNSClient } from "@aws-sdk/client-sns";
import { SNSEvent, SQSEvent } from "aws-lambda";
import { tracer } from "dd-trace";
import {
  ProductCreatedEvent,
  ProductCreatedEventHandler,
} from "../core/productCreatedEventHandler";
import { PricingService } from "../core/pricingService";
import { SnsEventPublisher } from "./snsEventPublisher";

const snsClient = new SNSClient();

const createProductHandler = new ProductCreatedEventHandler(
  new PricingService(),
  new SnsEventPublisher(snsClient)
);

export const handler = async (event: SNSEvent): Promise<string> => {
  const mainSpan = tracer.scope().active();

  for (const message of event.Records) {
    const data: ProductCreatedEvent = JSON.parse(message.Sns.Message);

    await createProductHandler.handle(data);
  }

  return "OK";
};
