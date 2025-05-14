package com.inventory.acl.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.core.InventoryItemService;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Named("handleProductCatalogueRefresh")
public class productCatalogueRefresh implements RequestHandler<String, String> {
    @Inject
    ObjectMapper objectMapper;
    Logger logger = LoggerFactory.getLogger(productCatalogueRefresh.class);
    @Inject
    InventoryItemService inventoryService;

    @Override
    public String handleRequest(String input, Context context) {
        var products = inventoryService.refreshProductCache();
        return "OK";
    }
}
