import { Logger } from "@aws-lambda-powertools/logger";
import { CloudEvent } from "cloudevents";
import { Span, SpanContext, tracer } from "dd-trace";

const textEncoder = new TextEncoder();
const logger = new Logger({});

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
}

export function startProcessSpanWithSemanticConventions(
  evt: CloudEvent<any>,
  conventions: SemanticConventions
): Span {

  const messageProcessingSpan = tracer.startSpan(`process ${evt.type}`, {
    childOf: conventions.parentSpan ?? undefined,
  });

  // Extract DSM pathway context. Prefer the Datadog standard "_datadog" carrier
  // object (used by Java and other Datadog-instrumented services), falling back
  // to the legacy CloudEvent extension attribute for older Node.js producers.
  //
  // DsmPathwayCodec.decode() handles both "dd-pathway-ctx-base64" (Node.js v2)
  // and "dd-pathway-ctx" (Java v1) so passing the whole _datadog object is safe.
  const datadogHeaders = (evt as any)["_datadog"];
  const dsmCarrier: Record<string, string> =
    datadogHeaders && typeof datadogHeaders === "object"
      ? { ...datadogHeaders }
      : {};
  tracer.dataStreamsCheckpointer.setConsumeCheckpoint("sqs", evt.type, dsmCarrier);

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
        JSON.stringify(evt.data)
      ).length,
    });

    if (evt.time != undefined && Date.parse(evt.time) > 0) {
      messageProcessingSpan.addTags({
        "messaging.message.age": Date.now() - Date.parse(evt.time),
      });
    }

    if (evt.traceparent !== undefined && evt.traceparent !== null) {
      const manualContext = new ManualContext(evt.traceparent!.toString());

      messageProcessingSpan.addLink(manualContext);
    }
  } catch (e) {
    logger.error(JSON.stringify(e));
  }

  return messageProcessingSpan;
}

/**
 * Starts a publish span and populates the provided carrier with DSM pathway
 * context and traceparent so the caller can embed it as "_datadog" in the
 * outgoing message — matching the Datadog standard used by Java services.
 *
 * The carrier will contain:
 *   - "dd-pathway-ctx-base64": DSM pathway context (readable by all dd-trace versions)
 *   - "traceparent": W3C trace context (for Java consumers that read from _datadog)
 */
export function startPublishSpanWithSemanticConventions(
  evt: CloudEvent<any>,
  conventions: SemanticConventions,
  carrier: Record<string, string> = {}
): Span {
  const messagingSpan = tracer.startSpan(`publish ${evt.type}`, {
    childOf: conventions.parentSpan ?? undefined,
  });

  try {
    tracer.dataStreamsCheckpointer.setProduceCheckpoint(
      conventions.messagingSystem,
      evt.type,
      carrier
    );

    // Embed traceparent in the carrier so Java consumers find it in _datadog
    const traceparent = conventions.parentSpan?.context().toTraceparent();
    if (traceparent) {
      carrier["traceparent"] = traceparent;
    }

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
        JSON.stringify(evt.data)
      ).length,
      "messaging.operation.name": "send",
      "messaging.message.conversation_id": conventions.conversationId ?? "",
    });
  } catch (e) {
    logger.error(JSON.stringify(e));
  }

  return messagingSpan;
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
