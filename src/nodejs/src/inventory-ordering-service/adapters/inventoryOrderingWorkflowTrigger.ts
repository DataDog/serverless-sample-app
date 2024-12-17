//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SNSEvent } from "aws-lambda";
import { Span, tracer } from "dd-trace";
import { Logger } from "@aws-lambda-powertools/logger";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { CloudEvent } from "cloudevents";
import { ProductAddedEvent } from "./productAddedEvent";
import { MessagingType, startProcessSpanWithSemanticConventions } from "../../observability/observability";

const logger = new Logger({});
const sfnClient = new SFNClient();

export const handler = async (event: SNSEvent): Promise<void> => {
  const mainSpan = tracer.scope().active()!;
  mainSpan.addTags({
    "messaging.operation.type": "receive",
  });

  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;

    try {
      logger.info(message.Sns.Message);

      const evtWrapper: CloudEvent<ProductAddedEvent> = JSON.parse(
        message.Sns.Message
      );

      messageProcessingSpan = startProcessSpanWithSemanticConventions(
        evtWrapper,
        {
          publicOrPrivate: MessagingType.PRIVATE,
          messagingSystem: "sns",
          destinationName: message.EventSource,
          parentSpan: mainSpan,
          conversationId: evtWrapper.data?.productId,
        }
      );

      await sfnClient.send(
        new StartExecutionCommand({
          stateMachineArn: process.env.ORDERING_SERVICE_WORKFLOW_ARN,
          input: JSON.stringify(evtWrapper.data!),
        })
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        const e = error as Error;
        logger.error(JSON.stringify(e));
        const stack = e.stack!.split("\n").slice(1, 4).join("\n");
        mainSpan.addTags({
          "error.stack": stack,
          "error.message": error.message,
          "error.type": "Error",
        });
      } else {
        logger.error(JSON.stringify(error));
        mainSpan.addTags({
          "error.type": "Error",
        });
      }

      // Rethrow error to pass back to Lambda runtime
      messageProcessingSpan?.finish();
      throw error;
    } finally {
      messageProcessingSpan?.finish();
    }
  }
};
