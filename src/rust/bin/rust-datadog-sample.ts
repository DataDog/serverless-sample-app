#!/usr/bin/env node
import {App} from "aws-cdk-lib";
import { ProductApiStack } from "../lib/product-api/product-api-stack";
import { ProductPublicEventPublisherStack } from "../lib/product-public-event-publisher/product-public-event-publisher-stack";
import { ProductPricingStack } from "../lib/product-pricing/product-pricing-stack";
import { SharedResourcesStack } from "../lib/shared-resources/shared-resources-stack";
import { ProductApiWorkerStack } from "../lib/product-api-workers/product-api-worker-stack";
import { InventoryAclStack } from "../lib/inventory-acl/inventoryAclStack";
import { InventoryOrderServiceStack } from "../lib/inventory-ordering-service/inventoryOrderingServiceStack";
import { AnalyticsBackendStack } from "../lib/analytics-backend/analyticsBackendStack";

const app = new App();

const sharedStack = new SharedResourcesStack(app, "RustSharedStack", {});
 
const apiStack = new ProductApiStack(app, "RustProductApiStack", {});
apiStack.addDependency(sharedStack);

const publicEventStack = new ProductPublicEventPublisherStack(
  app,
  "RustProductPublicEventPublisherStack",
  {}
);
publicEventStack.addDependency(sharedStack);
publicEventStack.addDependency(apiStack);

const productPricingStack = new ProductPricingStack(
  app,
  "RustProductPricingServiceStack",
  {}
);
productPricingStack.addDependency(apiStack);

const productApiWorkerStack = new ProductApiWorkerStack(
  app,
  "RustProductApiWorkerStack",
  {}
);
productApiWorkerStack.addDependency(apiStack);
productApiWorkerStack.addDependency(productPricingStack);

// const inventoryAcl = new InventoryAclStack(app, "RustInventoryAcl", {});
// inventoryAcl.addDependency(sharedStack);

// const inventoryOrderingService = new InventoryOrderServiceStack(
//   app,
//   "RustInventoryOrderingService",
//   {}
// );
// inventoryOrderingService.addDependency(inventoryAcl);

// const analyticsService = new AnalyticsBackendStack(app, "AnalyticsStack", {});
// analyticsService.addDependency(sharedStack);
