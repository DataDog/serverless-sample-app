package com.inventory.acl.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.core.InventoryItemService;
import jakarta.inject.Inject;
import jakarta.inject.Named;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

@Named("handleProductCatalogueRefresh")
public class productCatalogueRefresh implements RequestStreamHandler {
    @Inject
    ObjectMapper objectMapper;
    @Inject
    InventoryItemService inventoryService;

    @Override
    public void handleRequest(InputStream inputStream, OutputStream outputStream, Context context) throws IOException {
        var products = inventoryService.refreshProductCache();
        outputStream.write(objectMapper.writeValueAsBytes(products));
    }
}
