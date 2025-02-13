#!/bin/bash
function deploy {
  rm -r ./out/ -f
  mkdir out
  mkdir out/createProductFunction
  mkdir out/updateProductFunction
  mkdir out/deleteProductFunction
  mkdir out/getProductFunction
  mkdir out/listProductsFunction
  mkdir out/productCreatedPublicEventHandler
  mkdir out/inventoryOrderingWorkflowTrigger
  mkdir out/handlePricingChangedFunction
  mkdir out/publicEventPublisherFunction
  mkdir out/productCreatedPricingHandler
  mkdir out/productUpdatedPricingHandler
  mkdir out/analyticsEventHandler
  mkdir out/stockLevelUpdatedPublicEventHandler
  mkdir out/handleStockLevelUpdatedFunction

  cargo lambda build --release --manifest-path src/product-api/lambdas/create_product/Cargo.toml
  zip -r -j out/createProductFunction/createProductFunction.zip target/lambda/create-product/bootstrap
  
  cargo lambda build --release --manifest-path src/product-api/lambdas/update_product/Cargo.toml
  zip -r -j out/updateProductFunction/updateProductFunction.zip target/lambda/update-product/bootstrap
  
  cargo lambda build --release --manifest-path src/product-api/lambdas/delete_product/Cargo.toml
  zip -r -j out/deleteProductFunction/deleteProductFunction.zip target/lambda/delete-product/bootstrap
  
  cargo lambda build --release --manifest-path src/product-api/lambdas/get_product/Cargo.toml
  zip -r -j out/getProductFunction/getProductFunction.zip target/lambda/get-product/bootstrap

  cargo lambda build --release --manifest-path src/product-api/lambdas/list_products/Cargo.toml
  zip -r -j out/listProductsFunction/listProductsFunction.zip target/lambda/list-products/bootstrap

  cargo lambda build --release --manifest-path src/inventory-acl/lambdas/product_created_handler/Cargo.toml
  zip -r -j out/productCreatedPublicEventHandler/productCreatedPublicEventHandler.zip target/lambda/handle_product_created_event/bootstrap

  cargo lambda build --release --manifest-path src/inventory-ordering/lambdas/product_added_handler/Cargo.toml
  zip -r -j out/inventoryOrderingWorkflowTrigger/inventoryOrderingWorkflowTrigger.zip target/lambda/product-added-handler/bootstrap

  cargo lambda build --release --manifest-path src/product-api/lambdas/handle_pricing_updated/Cargo.toml
  zip -r -j out/handlePricingChangedFunction/handlePricingChangedFunction.zip target/lambda/handle-pricing-updated/bootstrap
  
  cargo lambda build --release --manifest-path src/product-api/lambdas/handle_stock_updated/Cargo.toml
  zip -r -j out/handleStockLevelUpdatedFunction/handleStockLevelUpdatedFunction.zip target/lambda/handle-stock-updated/bootstrap

  cargo lambda build --release --manifest-path src/product-event-publisher/lambdas/product_public_event_publisher/Cargo.toml
  zip -r -j out/publicEventPublisherFunction/publicEventPublisherFunction.zip target/lambda/product-public-event-publisher/bootstrap

  cargo lambda build --release --manifest-path src/product-pricing/lambdas/product_created_pricing_handler/Cargo.toml
  zip -r -j out/productCreatedPricingHandler/productCreatedPricingHandler.zip target/lambda/product-created-pricing-handler/bootstrap

  cargo lambda build --release --manifest-path src/product-pricing/lambdas/product_updated_pricing_handler/Cargo.toml
  zip -r -j out/productUpdatedPricingHandler/productUpdatedPricingHandler.zip target/lambda/product-updated-pricing-handler/bootstrap

  cargo lambda build --release --manifest-path src/analytics/lambdas/analytics/Cargo.toml
  zip -r -j out/analyticsEventHandler/analyticsEventHandler.zip target/lambda/analytics_handler/bootstrap

  cargo lambda build --release --manifest-path src/product-acl/lambdas/inventory_stock_updated_handler/Cargo.toml
  zip -r -j out/stockLevelUpdatedPublicEventHandler/stockLevelUpdatedPublicEventHandler.zip target/lambda/handle_inventory_stock_updated_event/bootstrap
}

deploy
