//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from "aws-lambda";
import { tracer } from "dd-trace";
import { Logger } from "@aws-lambda-powertools/logger";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const logger = new Logger({});
const sqsClient = new SQSClient({});

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const mainSpan = tracer.scope().active()!;
  mainSpan?.addTags({
    "messaging.batch.message_count": event.Records.length,
    "messaging.operation.type": "receive",
    "messaging.system": "aws_sqs",
  });

  const sqsFailures: SQSBatchItemFailure[] = [];

  for (const message of event.Records) {
    try {
      mainSpan.addTags({"message.id": message.messageId});
      mainSpan.addTags({"message.dlq": process.env.DLQ_URL});

      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: process.env.DLQ_URL,
          MessageBody: message.body,
        })
      );
    } catch (error) {
      logger.error(JSON.stringify(error));
      sqsFailures.push({
        itemIdentifier: message.messageId,
      });
    }
  }

  return {
    batchItemFailures: sqsFailures,
  };
};
