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
import java.time.Duration;
import java.util.ArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ApplicationScoped
public class HttpProductService implements ProductService {
    private final SsmClient ssmClient;
    private volatile String productApiEndpoint = "";
    private volatile long endpointCacheExpiry = 0;
    private static final Logger logger = LoggerFactory.getLogger(HttpProductService.class);
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    private static final int MAX_RETRIES = 3;
    private static final long INITIAL_BACKOFF_MS = 200;
    private static final long ENDPOINT_CACHE_TTL_MS = 5 * 60 * 1000L; // 5 minutes
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    @Inject
    public HttpProductService(SsmClient ssmClient) {
        this.ssmClient = ssmClient;
        this.objectMapper = new ObjectMapper();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                .build();
        this.refreshApiEndpoint(ssmClient);
    }

    @Override
    public ArrayList<ProductCatalogueItem> getProductCatalogue() {
        this.refreshApiEndpoint(ssmClient);
        if (productApiEndpoint == null) {
            logger.info("Product API endpoint not set");
            return new ArrayList<>();
        }

        logger.info("Fetching product catalogue from: " + productApiEndpoint);
        try {
            var httpRequest = HttpRequest.newBuilder(new URI(this.productApiEndpoint))
                    .header("accept", MediaType.APPLICATION_JSON)
                    .header("Content-Type", MediaType.APPLICATION_JSON)
                    .timeout(REQUEST_TIMEOUT)
                    .GET()
                    .build();

            HttpResponse<String> response = sendWithRetry(httpRequest);

            int statusCode = response.statusCode();
            if (statusCode < 200 || statusCode >= 300) {
                logger.error("Product API returned non-2xx status: " + statusCode);
                return new ArrayList<>();
            }

            logger.info("Product API responded with status: " + statusCode);

            ProductCatalogueGetResponse products = objectMapper.readValue(response.body(), ProductCatalogueGetResponse.class);

            return products.getData();
        } catch (Exception e) {
            logger.error("Error fetching product catalogue: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    private HttpResponse<String> sendWithRetry(HttpRequest request) throws Exception {
        Exception lastException = null;
        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                var response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                int statusCode = response.statusCode();
                if (statusCode >= 500 && attempt < MAX_RETRIES) {
                    logger.warn("Product API returned server error " + statusCode + ", retrying (attempt " + (attempt + 1) + "/" + MAX_RETRIES + ")");
                    Thread.sleep(INITIAL_BACKOFF_MS * (1L << attempt));
                    continue;
                }
                return response;
            } catch (java.io.IOException e) {
                lastException = e;
                if (attempt < MAX_RETRIES) {
                    logger.warn("HTTP request failed, retrying (attempt " + (attempt + 1) + "/" + MAX_RETRIES + "): " + e.getMessage());
                    Thread.sleep(INITIAL_BACKOFF_MS * (1L << attempt));
                }
            }
        }
        throw lastException;
    }

    private void refreshApiEndpoint(SsmClient ssmClient) {
        long now = System.currentTimeMillis();
        if (!productApiEndpoint.isEmpty() && now < endpointCacheExpiry) {
            return; // cached value is still valid
        }

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
            this.endpointCacheExpiry = now + ENDPOINT_CACHE_TTL_MS;
            logger.info("Product API endpoint refreshed from SSM: " + this.productApiEndpoint);
        } catch (Exception e) {
            logger.error("Failed to retrieve product API endpoint: " + e.getMessage());
        }
    }
}
