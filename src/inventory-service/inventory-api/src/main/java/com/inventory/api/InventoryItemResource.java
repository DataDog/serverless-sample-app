package com.inventory.api;

import com.inventory.api.filters.PublicEndpoint;
import com.inventory.core.*;
import io.smallrye.common.constraint.NotNull;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

@Path("/inventory")
public class InventoryItemResource {
    @Inject
    InventoryItemService service;

    private static final Logger LOG = Logger.getLogger(InventoryItemResource.class);

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response updateStockLevel(@NotNull UpdateInventoryStockRequest request) {
        LOG.info("Received update product stock request");
        var result = service.updateStock(request);

        if (!result.isSuccess()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(result)
                    .build();
        }

        return Response.status(Response.Status.OK)
                .entity(result)
                .build();
    }

    @GET
    @Path("/{productId}")
    @Produces(MediaType.APPLICATION_JSON)
    @PublicEndpoint
    public Response getProduct(@PathParam("productId")String productId) {
        LOG.info("Received get inventory item request");
        var result = service.withProductId(productId);

        if (!result.isSuccess()) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(result)
                    .build();
        }

        return Response.status(Response.Status.OK)
                .entity(result)
                .build();
    }
}
