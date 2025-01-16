import { EventPublisher, StockLevelUpdatedEvent } from "../core/inventory";

const logger = require("./logger");

export class NoOpEventPublisher implements EventPublisher {
  publish(evt: StockLevelUpdatedEvent): Promise<boolean> {
    logger.info(`Publishing: ${JSON.stringify(evt)}`);

    return Promise.resolve(true);
  }
}
