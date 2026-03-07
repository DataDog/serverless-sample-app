import axios from "axios";
import { LoyaltyPointsDTO } from "../../src/loyalty-api/core/loyaltyPointsDTO";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
const { PutEventsCommand } = require("@aws-sdk/client-eventbridge");
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

export class ApiDriver {
  apiEndpoint: string;
  eventBridgeClient: EventBridgeClient;
  eventBusName: string;
  tableName: string;
  dynamoClient: DynamoDBClient;

  constructor(apiEndpoint: string, eventBusName: string, tableName: string) {
    this.apiEndpoint = apiEndpoint;
    this.eventBridgeClient = new EventBridgeClient({});
    this.eventBusName = eventBusName;
    this.tableName = tableName;
    this.dynamoClient = new DynamoDBClient({});
  }

  async getLoyaltyPoints(bearerToken: string): Promise<LoyaltyPointsDTO> {
    const apiEndpoint = `${this.apiEndpoint}/loyalty`;

    const response = await axios.get(apiEndpoint, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    });
    return response.data.data;
  }

  async injectUserCreatedEvent(userId: string): Promise<void> {
    const environment = process.env.ENV || "dev";

    const id = Date.now().toString() + Math.random().toString().substring(2);

    const event = {
      specversion: "1.0",
      type: "users.userCreated.v1",
      source: `${environment}.users`,
      id,
      time: new Date().toISOString(),
      datacontenttype: "application/json",
      data: {
        userId: userId,
      },
    };

    const putEventsCommand = {
      Source: event.source,
      DetailType: event.type,
      Detail: JSON.stringify(event),
      EventBusName: this.eventBusName,
    };

    // Send the event to EventBridge
    await this.eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [putEventsCommand],
      })
    );
  }

  async injectOrderCompletedEvent(
    userId: string,
    orderNumber: string
  ): Promise<void> {
    const environment = process.env.ENV || "dev";

    const id = Date.now().toString() + Math.random().toString().substring(2);

    const event = {
      specversion: "1.0",
      type: "orders.orderCompleted.v1",
      source: `${environment}.orders`,
      id,
      time: new Date().toISOString(),
      datacontenttype: "application/json",
      data: {
        userId: userId,
        orderNumber: orderNumber,
      },
    };

    const putEventsCommand = {
      Source: event.source,
      DetailType: event.type,
      Detail: JSON.stringify(event),
      EventBusName: this.eventBusName,
    };

    // Send the event to EventBridge
    await this.eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [putEventsCommand],
      })
    );
  }

  async injectOrderCompletedV2Event(
    userId: string,
    orderNumber: string
  ): Promise<void> {
    const environment = process.env.ENV || "dev";

    const id = Date.now().toString() + Math.random().toString().substring(2);

    const event = {
      specversion: "1.0",
      type: "orders.orderCompleted.v2",
      source: `${environment}.orders`,
      id,
      time: new Date().toISOString(),
      datacontenttype: "application/json",
      data: {
        userId: userId,
        orderId: orderNumber,
      },
    };

    const putEventsCommand = {
      Source: event.source,
      DetailType: event.type,
      Detail: JSON.stringify(event),
      EventBusName: this.eventBusName,
    };

    // Send the event to EventBridge
    await this.eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [putEventsCommand],
      })
    );
  }

  async injectLoyaltyPointsAddedEvent(
    userId: string,
    totalPoints: number,
    difference: number
  ): Promise<void> {
    const environment = process.env.ENV || "dev";

    const id = Date.now().toString() + Math.random().toString().substring(2);

    const event = {
      specversion: "1.0",
      type: "loyalty.pointsAdded.v2",
      source: `${environment}.loyalty`,
      id,
      time: new Date().toISOString(),
      datacontenttype: "application/json",
      data: {
        userId,
        totalPoints,
        difference,
      },
    };

    const putEventsCommand = {
      Source: event.source,
      DetailType: event.type,
      Detail: JSON.stringify(event),
      EventBusName: this.eventBusName,
    };

    // Send the event to EventBridge
    await this.eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [putEventsCommand],
      })
    );
  }

  async getTierForUser(userId: string): Promise<{
    tier: string;
    tierVersion: number;
    pointsAtUpgrade: number;
    upgradedAt: string;
    notifiedAt?: string;
  } | null> {
    const result = await this.dynamoClient.send(
      new GetItemCommand({
        TableName: this.tableName,
        Key: {
          PK: { S: `TIER#${userId}` },
        },
      })
    );

    if (result.Item === undefined) {
      return null;
    }

    return {
      tier: result.Item["Tier"]?.S ?? "Bronze",
      tierVersion: result.Item["TierVersion"]?.N
        ? parseInt(result.Item["TierVersion"].N, 10)
        : 0,
      pointsAtUpgrade: result.Item["PointsAtUpgrade"]?.N
        ? parseInt(result.Item["PointsAtUpgrade"].N, 10)
        : 0,
      upgradedAt: result.Item["UpgradedAt"]?.S ?? "",
      notifiedAt: result.Item["NotifiedAt"]?.S,
    };
  }
}
