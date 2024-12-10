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
import { Span, SpanContext, tracer } from "dd-trace";
import { Logger } from "@aws-lambda-powertools/logger";
import { CloudEvent } from "cloudevents";
import { generateProcessingSpanFor } from "../../observability/observability";

const logger = new Logger({});

export const handler = async (
  event: SQSEvent,
  context: Context
): Promise<SQSBatchResponse> => {
  const mainSpan = tracer.scope().active()!;
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const message of event.Records) {
    let messageProcessingSpan: Span | undefined = undefined;

    try {
      // no-dd-sa:typescript-best-practices/no-explicit-any
      const parsedBody = JSON.parse(message.body) as EventBridgeEvent<any, any>;

      const manualContext = new ManualContext(
        parsedBody.detail._datadog.traceparent
      );
      const evtWrapper = parsedBody["detail"] as CloudEvent<any>;

      messageProcessingSpan = generateProcessingSpanFor(
        evtWrapper,
        "sqs",
        mainSpan,
        undefined
      );

      messageProcessingSpan.addLink(manualContext);

      tracer.dogstatsd.increment(parsedBody["detail-type"], 1);
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
      batchItemFailures.push({
        itemIdentifier: message.messageId,
      });
    } finally {
      messageProcessingSpan?.finish();
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
