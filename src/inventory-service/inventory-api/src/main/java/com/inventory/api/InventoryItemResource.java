package com.inventory.api;

import com.inventory.core.*;
import io.smallrye.common.constraint.NotNull;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;

import java.util.List;

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
        try{
            var result = service.updateStock(request);

            return Response.status(Response.Status.OK) // Set the status code
                    .entity(result) // Set the response body
                    .build();
        }
        catch (DataAccessException e){
            LOG.error("Data access exception occurred while updating stock level", e);
            var responseBody = new HandlerResponse<String>("Error", List.of("Internal error"), false);
            return Response.status(Response.Status.OK) // Set the status code
                    .entity(responseBody) // Set the response body
                    .build();
        }
    }

    @GET
    @Path("/{productId}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getProduct(@PathParam("productId")String productId) {
        LOG.info("Received get inventory item request");
        try{
            var result = service.withProductId(productId);

            return Response.status(Response.Status.OK) // Set the status code
                    .entity(result) // Set the response body
                    .build();
        }
        catch (InventoryItemNotFoundException e){
            LOG.warn("Product not found", e);
            var responseBody = new HandlerResponse<String>("Not found", List.of("Not found"), false);
            return Response.status(Response.Status.NOT_FOUND) // Set the status code
                    .entity(responseBody) // Set the response body
                    .build();
        }
        catch (DataAccessException e){
            LOG.error("Data access exception occurred while updating stock level", e);
            var responseBody = new HandlerResponse<String>("Error", List.of("Internal error"), false);
            return Response.status(Response.Status.OK) // Set the status code
                    .entity(responseBody) // Set the response body
                    .build();
        }
    }
}
