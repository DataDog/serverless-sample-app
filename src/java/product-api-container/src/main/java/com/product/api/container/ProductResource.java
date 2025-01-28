package com.product.api.container;

import com.product.api.container.core.*;
import io.smallrye.common.constraint.NotNull;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.jboss.logging.Logger;

import java.util.List;

@Path("/product")
public class ProductResource {
    @Inject
    ProductService service;

    private static final Logger LOG = Logger.getLogger(ProductResource.class);
    
    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public HandlerResponse<List<ProductDTO>> listProducts() {
        LOG.info("Received list products request");
        return service.listProducts();
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public HandlerResponse<ProductDTO> createProduct(@NotNull CreateProductRequest request) {
        LOG.info("Received create product request");

        return service.createProduct(request);
    }

    @GET
    @Path("/{productId}")
    @Produces(MediaType.APPLICATION_JSON)
    public HandlerResponse<ProductDTO> getProduct(@PathParam("productId")String productId) {
        LOG.info("Received get product request");
        return service.getProduct(productId);
    }

    @PUT
    @Produces(MediaType.APPLICATION_JSON)
    @Consumes(MediaType.APPLICATION_JSON)
    public HandlerResponse<ProductDTO> updateProduct(@PathParam("productId")String productId, UpdateProductRequest request) {
        LOG.info("Received update products request");
        return service.updateProduct(request);
    }

    @DELETE
    @Path("/{productId}")
    @Produces(MediaType.APPLICATION_JSON)
    public HandlerResponse<Boolean> deleteProduct(@PathParam("productId")String productId) {
        LOG.info("Received delete products request");
        return service.deleteProduct(productId);
    }
}
