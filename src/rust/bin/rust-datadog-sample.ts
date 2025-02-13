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
import { InventoryApiStack } from "../lib/inventory-api/inventoryApiStack";
import { ProductAclStack } from "../lib/product-acl/productAclStack";

const app = new App();

const sharedStack = new SharedResourcesStack(app, "RustSharedStack", {});

const productAclService = new ProductAclStack(app, "NodeProductAclService", {});
productAclService.addDependency(sharedStack);
 
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
productApiWorkerStack.addDependency(productAclService);

const inventoryAcl = new InventoryAclStack(app, "RustInventoryAcl", {});
inventoryAcl.addDependency(sharedStack);

const inventoryApiStack = new InventoryApiStack(
  app,
  "RustInventoryApiStack",
  {}
);

const inventoryOrderingService = new InventoryOrderServiceStack(
  app,
  "RustInventoryOrderingService",
  {}
);
inventoryOrderingService.addDependency(inventoryAcl);
inventoryOrderingService.addDependency(inventoryApiStack);

const analyticsService = new AnalyticsBackendStack(app, "RustAnalyticsStack", {});
analyticsService.addDependency(sharedStack);
