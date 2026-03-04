package com.inventory.api;

import com.inventory.core.DataAccessException;
import com.inventory.core.HandlerResponse;
import com.inventory.core.InventoryItemNotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

import java.util.List;

@Provider
public class ApiExceptionMapper implements ExceptionMapper<Exception> {
    private static final Logger LOG = Logger.getLogger(ApiExceptionMapper.class);

    @Override
    public Response toResponse(Exception exception) {
        // Let JAX-RS framework exceptions (404, 405, 400, etc.) pass through unchanged
        // so clients receive the correct HTTP status rather than a generic 500.
        if (exception instanceof WebApplicationException wae) {
            return wae.getResponse();
        }

        if (exception instanceof InventoryItemNotFoundException e) {
            LOG.warn("Inventory item not found: " + e.getInventoryItemId());
            var body = new HandlerResponse<String>("Not found", List.of(e.getMessage()), false);
            return Response.status(Response.Status.NOT_FOUND)
                    .type(MediaType.APPLICATION_JSON)
                    .entity(body)
                    .build();
        }

        if (exception instanceof DataAccessException) {
            LOG.error("Data access error", exception);
            var body = new HandlerResponse<String>("Error", List.of("Internal server error"), false);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .type(MediaType.APPLICATION_JSON)
                    .entity(body)
                    .build();
        }

        LOG.error("Unexpected error", exception);
        var body = new HandlerResponse<String>("Error", List.of("Internal server error"), false);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .type(MediaType.APPLICATION_JSON)
                .entity(body)
                .build();
    }
}
