import { App } from "sst/constructs";
import { Construct } from "constructs";
import { LoyaltyApiStack } from "./lib/loyalty-api/loyaltyApiStack";

export default {
  config() {
    return {
      name: "loyalty-point-service",
      region: process.env.AWS_REGION ?? "us-east-1",
    };
  },
  stacks(app: App) {
    // Set ENV to the current stage so that we send traces with this env to Datadog, e.g. "personal" or "dev"
    process.env.ENV = app.stage;
    new LoyaltyApiStack(app as unknown as Construct, `LoyaltyApiStack-${app.stage}`);
  },
};
