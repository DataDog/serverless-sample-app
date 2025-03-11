import { App } from "sst/constructs";
import { ProductApiStack } from "./lib/pricing-api/pricingApiStack";
import { ProductPublicEventPublisherStack } from "./lib/product-public-event-publisher/product-public-event-publisher-stack";
import { SharedResourcesStack } from "./lib/shared-resources/shared-resources-stack";
import { ProductPricingStack } from "./lib/product-pricing/product-pricing-stack";
import { ProductApiWorkerStack } from "./lib/product-api-workers/product-api-worker-stack";
import { InventoryAclStack } from "./lib/inventory-acl/inventoryAclStack";
import { InventoryOrderServiceStack } from "./lib/inventory-ordering-service/inventoryOrderingServiceStack";
import { AnalyticsBackendStack } from "./lib/analytics-backend/analyticsBackendStack";
import { InventoryApiStack } from "./lib/inventory-api/inventoryApiStack";
import { ProductAclStack } from "./lib/product-acl/productAclStack";

export default {
  config() {
    return {
      name: "serverless-sample-app",
      region: process.env.AWS_REGION ?? "us-east-1",
    };
  },
  stacks(app: App) {
    // Set ENV to the current stage so that we send traces with this env to Datadog, e.g. "personal" or "dev"
    process.env.ENV = app.stage;
    const shared = new SharedResourcesStack(
      app,
      `SharedResources-${app.stage}`
    );
    const productApi = new ProductApiStack(app, `ProductApiStack-${app.stage}`);
    const eventPublisher = new ProductPublicEventPublisherStack(
      app,
      `ProductPublicEventPublisherStack-${app.stage}`
    );
    eventPublisher.addDependency(productApi);
    eventPublisher.addDependency(shared);

    const pricing = new ProductPricingStack(
      app,
      `ProductPricingStack-${app.stage}`
    );
    pricing.addDependency(productApi);

    const productAclService = new ProductAclStack(
      app,
      "NodeProductAclService",
      {}
    );
    productAclService.addDependency(shared);

    const apiWorker = new ProductApiWorkerStack(
      app,
      `ProductApiWorkerStack-${app.stage}`
    );
    apiWorker.addDependency(pricing);
    apiWorker.addDependency(productAclService);

    const inventoryApiStack = new InventoryApiStack(
      app,
      "NodeInventoryApiStack",
      {}
    );

    const inventoryAcl = new InventoryAclStack(
      app,
      `InventoryAclStack-${app.stage}`
    );
    inventoryAcl.addDependency(shared);

    const inventoryOrdering = new InventoryOrderServiceStack(
      app,
      `InventoryOrderServiceStack-${app.stage}`
    );
    inventoryOrdering.addDependency(inventoryAcl);
    inventoryOrdering.addDependency(inventoryApiStack);

    const analyticsBackend = new AnalyticsBackendStack(
      app,
      `AnalyticsBackendStack-${app.stage}`
    );
    analyticsBackend.addDependency(shared);
  },
};
