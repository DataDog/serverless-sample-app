import { Logger } from "@aws-lambda-powertools/logger";
import { CloudEvent } from "cloudevents";
import { Span, SpanContext, tracer } from "dd-trace";
import * as os from "os";

const textEncoder = new TextEncoder();
const logger = new Logger({});

export const DSM_PROPAGATION_KEY_BASE_64 = "dd-pathway-ctx-base64";

export enum MessagingType {
  PUBLIC,
  PRIVATE,
}

export interface SemanticConventions {
  publicOrPrivate: MessagingType;
  messagingSystem: string;
  destinationName: string;
  parentSpan: Span | undefined | null;
  conversationId?: string | undefined;
  linkedTraceparent?: string | undefined;
}

export function startProcessSpanWithSemanticConventions(
  evt: CloudEvent<any>,
  conventions: SemanticConventions,
): Span {
  const messageProcessingSpan = tracer.startSpan(`process ${evt.type}`, {
    childOf: conventions.parentSpan ?? undefined,
  });

  // Extract the DSM-specific header from the event data to set the consume checkpoint, enabling Datadog's Data Streams Monitoring to track this message consumption
  const dsmHeader = (evt.data as Record<string, unknown>)[
    DSM_PROPAGATION_KEY_BASE_64
  ];
  tracer.dataStreamsCheckpointer.setConsumeCheckpoint(
    "eventbridge",
    evt.type,
    dsmHeader,
  );

  try {
    messageProcessingSpan.addTags({
      domain: process.env.DOMAIN,
      "messaging.message.eventType":
        MessagingType[conventions.publicOrPrivate].toLowerCase(),
      "messaging.system": conventions.messagingSystem,
      "messaging.operation.name": "process",
      "messaging.operation.type": "process",
      "messaging.message.type": evt.type,
      "messaging.message.domain": evt.source,
      "messaging.message.id": evt.id,
      "messaging.message.published_at": evt.time,
      "messaging.client.id": process.env.AWS_LAMBDA_FUNCTION_NAME ?? "",
      "messaging.consumer.group.name": process.env.DD_SERVICE,
      "messaging.message.conversation_id": conventions.conversationId ?? "",
      "messaging.message.envelope.size": textEncoder.encode(JSON.stringify(evt))
        .length,
      "messaging.message.body.size": textEncoder.encode(
        JSON.stringify(evt.data),
      ).length,
    });

    if (evt.time != undefined && Date.parse(evt.time) > 0) {
      messageProcessingSpan.addTags({
        "messaging.message.age": Date.now() - Date.parse(evt.time),
      });
    }

    if (evt.traceparent !== undefined) {
      const manualContext = new ManualContext(evt.traceparent!.toString());

      messageProcessingSpan.addLink({ context: manualContext });
    }
  } catch (e) {
    logger.error(JSON.stringify(e));
  }

  return messageProcessingSpan;
}

export function startPublishSpanWithSemanticConventions(
  evt: CloudEvent<any>,
  conventions: SemanticConventions,
): { span: Span; carrier: Record<string, string> } {
  const messagingSpan = tracer.startSpan(`publish ${evt.type}`, {
    childOf: conventions.parentSpan ?? undefined,
  });

  const carrier = {};

  try {
    tracer.dataStreamsCheckpointer.setProduceCheckpoint(
      "eventbridge",
      evt.type,
      carrier,
    );

    messagingSpan.addTags({
      domain: process.env.DOMAIN,
      "messaging.message.eventType":
        MessagingType[conventions.publicOrPrivate].toLowerCase(),
      "messaging.message.type": evt.type,
      "messaging.message.domain": process.env.DOMAIN,
      "messaging.message.id": evt.id,
      "messaging.operation.type": "publish",
      "messaging.system": conventions.messagingSystem,
      "messaging.batch.message_count": 1,
      "messaging.destination.name": conventions.destinationName,
      "messaging.client.id": process.env.AWS_LAMBDA_FUNCTION_NAME ?? "",
      "messaging.message.envelope.size": textEncoder.encode(JSON.stringify(evt))
        .length,
      "messaging.message.body.size": textEncoder.encode(
        JSON.stringify(evt.data),
      ).length,
      "messaging.operation.name": "send",
      "messaging.message.conversation_id": conventions.conversationId ?? "",
    });

    if (conventions.linkedTraceparent !== undefined) {
      const manualContext = new ManualContext(conventions.linkedTraceparent);
      messagingSpan.addLink({ context: manualContext });
    }
  } catch (e) {
    logger.error(JSON.stringify(e));
  }

  return { span: messagingSpan, carrier };
}

export function addDefaultServiceTagsTo(span: Span | undefined | null) {
  if (span === undefined || span === null) {
    return;
  }
  span.addTags({
    "service.team": process.env.TEAM ?? "",
    "build.id": process.env.BUILD_ID,
    "build.deployed_at": process.env.DEPLOYED_AT,
  });
}

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
