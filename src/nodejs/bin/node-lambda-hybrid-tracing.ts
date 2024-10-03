#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ProductApiStack } from "../lib/product-api/product-api-stack";
import { ProductPublicEventPublisherStack } from "../lib/product-public-event-publisher/product-public-event-publisher-stack";
import { ProductPricingStack } from "../lib/product-pricing/product-pricing-stack";
import { SharedResourcesStack } from "../lib/shared-resources/shared-resources-stack";
import { ProductApiWorkerStack } from "../lib/product-api-workers/product-api-worker-stack";
import { InventoryAclStack } from "../lib/inventory-acl/inventoryAclStack";
import { InventoryOrderServiceStack } from "../lib/inventory-ordering-service/inventoryOrderingServiceStack";
import { AnalyticsBackendStack } from "../lib/analytics-backend/analyticsBackendStack";

const app = new cdk.App();

const sharedStack = new SharedResourcesStack(app, "NodeSharedStack", {});
 
const apiStack = new ProductApiStack(app, "NodeProductApiStack", {});
apiStack.addDependency(sharedStack);

const publicEventStack = new ProductPublicEventPublisherStack(
  app,
  "NodeProductPublicEventPublisherStack",
  {}
);
publicEventStack.addDependency(sharedStack);
publicEventStack.addDependency(apiStack);

const productPricingStack = new ProductPricingStack(
  app,
  "NodeProductPricingServiceStack",
  {}
);
productPricingStack.addDependency(apiStack);

const productApiWorkerStack = new ProductApiWorkerStack(
  app,
  "NodeProductApiWorkerStack",
  {}
);
productApiWorkerStack.addDependency(apiStack);
productApiWorkerStack.addDependency(productPricingStack);

const inventoryAcl = new InventoryAclStack(app, "NodeInventoryAcl", {});
inventoryAcl.addDependency(sharedStack);

const inventoryOrderingService = new InventoryOrderServiceStack(
  app,
  "NodeInventoryOrderingService",
  {}
);
inventoryOrderingService.addDependency(inventoryAcl);

const analyticsService = new AnalyticsBackendStack(app, "NodeAnalyticsStack", {});
analyticsService.addDependency(sharedStack);
