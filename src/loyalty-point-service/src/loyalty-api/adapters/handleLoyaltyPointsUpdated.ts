import { Logger } from "@aws-lambda-powertools/logger";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { DynamoDBStreamEvent, DynamoDBRecord } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import { EventBridgeEventPublisher } from "./eventBridgeEventPublisher";
import { LoyaltyPoints } from "../core/loyaltyPoints";
import { Span, tracer } from "dd-trace";

const logger = new Logger({});
const eventBridgeClient = new EventBridgeClient();
const eventPublisher = new EventBridgeEventPublisher(eventBridgeClient);

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  try {
    const mainSpan = tracer.scope().active()!;

    logger.info("Processing DynamoDB stream events");

    mainSpan.setTag("messaging.batchSize", event.Records.length);

    // Filter to only process creates and updates, ignoring deletes
    const relevantRecords = event.Records.filter(
      (record) => record.eventName === "INSERT" || record.eventName === "MODIFY"
    );

    mainSpan.setTag("messaging.processBatchSize", relevantRecords.length);

    // Process each relevant record
    for (const record of relevantRecords) {
      await processLoyaltyPointsRecord(mainSpan, record);
    }

    logger.info("Successfully processed all records");
  } catch (error) {
    logger.error(JSON.stringify(error));
    throw error;
  }
};

async function processLoyaltyPointsRecord(
  activeSpan: Span,
  record: DynamoDBRecord
): Promise<void> {
  const messageProcessingSpan = tracer.startSpan("processLoyaltyPointsRecord", {
    childOf: activeSpan,
    tags: {
      "messaging.operation.type": "process",
      "messaging.system": "dynamodb",
      "messaging.destination": record.eventSource,
      "messaging.destination_kind": "stream",
      "messaging.message_id": record.eventID,
      "messaging.message_type": record.eventName,
    },
  });

  try {
    if (!record.dynamodb?.NewImage) {
      logger.info("No new image found in the record, skipping");
      return;
    }

    // Convert DynamoDB object to JavaScript object
    const loyaltyData = DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

    const pk = loyaltyData["PK"];
    const points = Number(loyaltyData["Points"]);
    const ordersRaw = loyaltyData["Orders"];
    const orders = Array.isArray(ordersRaw) ? ordersRaw : JSON.parse(ordersRaw ?? "[]");

    const loyaltyAccount = new LoyaltyPoints(pk, points, orders);

    await eventPublisher.publishLoyaltyPointsUpdated({
      userId: loyaltyAccount.userId,
      totalPoints: loyaltyAccount.currentPoints,
      difference: 50,
    });
  } catch (error) {
    logger.error(JSON.stringify(error));
    messageProcessingSpan?.logEvent("error", error);
    throw error;
  } finally {
    messageProcessingSpan?.finish();
  }
}
