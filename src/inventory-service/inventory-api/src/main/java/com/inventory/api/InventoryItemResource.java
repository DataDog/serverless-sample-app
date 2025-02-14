package com.inventory.api;

import com.inventory.api.core.HandlerResponse;
import com.inventory.api.core.InventoryItemDTO;
import com.inventory.api.core.InventoryItemService;
import com.inventory.api.core.UpdateInventoryStockRequest;
import io.smallrye.common.constraint.NotNull;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.jboss.logging.Logger;

@Path("/inventory")
public class InventoryItemResource {
    @Inject
    InventoryItemService service;

    private static final Logger LOG = Logger.getLogger(InventoryItemResource.class);

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public HandlerResponse<InventoryItemDTO> updateStockLevel(@NotNull UpdateInventoryStockRequest request) {
        LOG.info("Received update product stock request");

        return service.updateStock(request);
    }

    @GET
    @Path("/{productId}")
    @Produces(MediaType.APPLICATION_JSON)
    public HandlerResponse<InventoryItemDTO> getProduct(@PathParam("productId")String productId) {
        LOG.info("Received get inventory item request");
        return service.withProductId(productId);
    }
}
