//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import {
  Context,
  EventBridgeEvent,
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
} from "aws-lambda";
import { SpanContext, tracer } from "dd-trace";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({});

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<SQSBatchResponse> => {
  const mainSpan = tracer.scope().active()!;
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const message of event.Records) {
    const messageProcessingSpan = tracer.startSpan("process", {
      childOf: mainSpan,
    });

    try {
      const parsedBody = JSON.parse(message.body) as EventBridgeEvent<any, any>;

      const manualContext = new ManualContext(
        parsedBody.detail._datadog.traceparent
      );

      messageProcessingSpan.addLink(manualContext);

      messageProcessingSpan.addTags({
        "messaging.system": "sqs",
        "messaging.operation.name": "process",
        "messaging.operation.type": "receive",
        "messaging.type": parsedBody["detail-type"],
      });
      tracer.dogstatsd.increment(parsedBody["detail-type"], 1);
    } catch (error: any) {
      logger.error(JSON.stringify(error));
      const stack = error.stack.split("\n").slice(1, 4).join("\n");
      mainSpan.addTags({
        "error.stack": stack,
        "error.message": error.message,
        "error.type": "Error",
      });
      batchItemFailures.push({
        itemIdentifier: message.messageId,
      });
    } finally {
      messageProcessingSpan.finish();
    }
  }

  return {
    batchItemFailures,
  };
};

class ManualContext implements SpanContext {
  private traceId: string;
  private spanId: string;
  private traceParent: string;

  constructor(traceParent: string) {
    this.traceParent = traceParent;
    const splitParent = traceParent.split("-");
    this.traceId = splitParent[1];
    this.spanId = splitParent[2];
  }

  toTraceId(): string {
    return this.traceId;
  }
  toSpanId(): string {
    return this.spanId;
  }
  toTraceparent(): string {
    return this.traceParent;
  }
}
