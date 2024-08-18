import { App } from "sst/constructs";
import { ProductApiStack } from "./lib/product-api/product-api-stack";

export default {
  config() {
    return {
      name: "serverless-sample-app",
      region: "us-east-1",
    };
  },
  stacks(app: App) {
    // Set ENV to the current stage so that we send traces with this env to Datadog, e.g. "personal" or "dev"
    process.env.ENV = app.stage;
    new ProductApiStack(app, `ProductApiStack-${app.stage}`);
  },
};
