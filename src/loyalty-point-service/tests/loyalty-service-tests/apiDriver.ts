import axios from "axios";
import { HandlerResponse } from "../../src/loyalty-api/core/handlerResponse";
import { LoyaltyPointsDTO } from "../../src/loyalty-api/core/loyaltyPointsDTO";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
const { PutEventsCommand } = require("@aws-sdk/client-eventbridge");

export class ApiDriver {
  apiEndpoint: string;
  eventBridgeClient: EventBridgeClient;
  eventBusName: string;

  constructor(apiEndpoint: string, eventBusName: string) {
    this.apiEndpoint = apiEndpoint;
    this.eventBridgeClient = new EventBridgeClient({});
    this.eventBusName = eventBusName;
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
}
