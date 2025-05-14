package com.inventory.core.adapters;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.core.ProductService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.MediaType;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParameterRequest;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.logging.Logger;

@ApplicationScoped
public class HttpProductService implements ProductService {
    private String productApiEndpoint = "";
    private static final Logger LOG = Logger.getLogger(HttpProductService.class.getName());
    private final ObjectMapper objectMapper;

    @Inject
    public HttpProductService(SsmClient ssmClient) {
        this.objectMapper = new ObjectMapper();
        // Retrieve the product API endpoint from SSM Parameter Store
        try {
            var productApiEndpointSsmParameterName = System.getenv("PRODUCT_API_ENDPOINT_PARAMETER");
            var productApiBase = ssmClient.getParameter(GetParameterRequest.builder()
                    .name(productApiEndpointSsmParameterName)
                    .build())
                    .parameter()
                    .value();
            if (productApiBase.endsWith("/")) {
                productApiBase = productApiBase.substring(0, productApiBase.length() - 1);
            }
            this.productApiEndpoint = String.format("%s/product", productApiBase);
            LOG.info("Product API endpoint set to: " + this.productApiEndpoint);
        } catch (Exception e) {
            LOG.severe("Failed to retrieve product API endpoint: " + e.getMessage());
        }
    }

    @Override
    public ArrayList<ProductCatalogueItem> getProductCatalogue() {
        if (productApiEndpoint == null) {
            LOG.info("Product API endpoint not set");
            return new ArrayList<>();
        }

        LOG.info("Fetching product catalogue from: " + productApiEndpoint);
        try {
            var httpRequest = HttpRequest.newBuilder(new URI(this.productApiEndpoint))
                    .header("accept", MediaType.APPLICATION_JSON)
                    .header("Content-Type", MediaType.APPLICATION_JSON)
                    .GET()
                    .build();

            var response = HttpClient.newBuilder()
                    .build()
                    .send(httpRequest, HttpResponse.BodyHandlers.ofString());

            LOG.info("Response from product API: " + response.body());

            ProductCatalogueGetResponse products = objectMapper.readValue(response.body(), ProductCatalogueGetResponse.class);

            return products.getData();
        } catch (Exception e) {
            LOG.severe("Error fetching product catalogue: " + e.getMessage());
            return new ArrayList<>();
        }
    }
}
