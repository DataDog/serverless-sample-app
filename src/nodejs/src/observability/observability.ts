import { Logger } from "@aws-lambda-powertools/logger";
import { CloudEvent } from "cloudevents";
import { Span, tracer } from "dd-trace";

const textEncoder = new TextEncoder();
const logger = new Logger({});

export function generateProcessingSpanFor(
  evt: CloudEvent<any>,
  messagingSystem: String,
  parentSpan: Span | undefined,
  conversationId: String | undefined
): Span {
  const messageProcessingSpan = tracer.startSpan("process", {
    childOf: parentSpan,
  });

  try {
    messageProcessingSpan.addTags({
      domain: process.env.DOMAIN,
      "messaging.system": messagingSystem,
      "messaging.operation.name": "process",
      "messaging.operation.type": "process",
      "messaging.message.type": evt.type,
      "messaging.message.domain": evt.source,
      "messaging.message.id": evt.id,
      "messaging.message.published_at": evt.time,
      "messaging.client.id": process.env.AWS_LAMBDA_FUNCTION_NAME ?? "",
      "messaging.consumer.group.name": process.env.DD_SERVICE,
      "messaging.message.conversation_id": conversationId ?? "",
    });

    if (evt.time != undefined && Date.parse(evt.time) > 0) {
      messageProcessingSpan.addTags({
        "messaging.message.age": Date.now() - Date.parse(evt.time),
      });
    }
  } catch (e) {
    logger.error(JSON.stringify(e));
  }

  return messageProcessingSpan;
}

export function addMessagingTags(
  evt: CloudEvent<any>,
  messagingSystem: String,
  destinationName: String,
  messagingSpan: Span,
  conversationId: String | undefined,
  eventType: String
) {
  try {
    messagingSpan.addTags({
      domain: process.env.DOMAIN,
      "messaging.message.eventType": eventType,
      "messaging.message.type": evt.type,
      "messaging.message.domain": process.env.DOMAIN,
      "messaging.message.id": evt.id,
      "messaging.operation.type": "publish",
      "messaging.system": messagingSystem,
      "messaging.batch.message_count": 1,
      "messaging.destination.name": destinationName,
      "messaging.client.id": process.env.AWS_LAMBDA_FUNCTION_NAME ?? "",
      "messaging.message.envelope.size": textEncoder.encode(JSON.stringify(evt))
        .length,
      "messaging.message.body.size": textEncoder.encode(
        JSON.stringify(evt.data)
      ).length,
      "messaging.operation.name": "send",
      "messaging.message.conversation_id": conversationId ?? "",
    });
  } catch (e) {
    logger.error(JSON.stringify(e));
  }
}
