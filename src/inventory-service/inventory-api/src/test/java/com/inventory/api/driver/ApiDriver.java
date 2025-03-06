package com.inventory.api.driver;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import software.amazon.awssdk.services.eventbridge.EventBridgeClient;
import software.amazon.awssdk.services.eventbridge.model.PutEventsRequest;
import software.amazon.awssdk.services.eventbridge.model.PutEventsRequestEntry;
import software.amazon.awssdk.services.eventbridge.model.PutEventsResponse;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParameterRequest;
import software.amazon.awssdk.services.ssm.model.GetParameterResponse;

import java.time.Duration;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;

public class ApiDriver {
    static final int SLEEP_TIME_BETWEEN_RETRIES=5000;
    static final int MAX_RETRIES=5;
    static final int HTTP_TIMEOUT=20;

    private final EventBridgeClient eventBridgeClient;
    private final String apiEndpoint;
    private final String secretKey;
    private final String busName;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public ApiDriver(String env, SsmClient ssmClient, EventBridgeClient eventBridgeClient, ObjectMapper objectMapper) {
        this.eventBridgeClient = eventBridgeClient;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(HTTP_TIMEOUT))
                .build();
        this.objectMapper = objectMapper;

        this.apiEndpoint = getParameterValue(ssmClient, String.format("/%s/InventoryService/api-endpoint", env));
        this.secretKey = getParameterValue(ssmClient, String.format("/%s/shared/secret-access-key", env));
        this.busName = getParameterValue(ssmClient, String.format("/%s/shared/event-bus-name", env));
    }

    private String getParameterValue(SsmClient ssmClient, String paramName) {
        GetParameterRequest request = GetParameterRequest.builder().name(paramName).withDecryption(true).build();
        GetParameterResponse response = ssmClient.getParameter(request);
        return response.parameter().value();
    }

    public ApiResponse<ProductDTO> getProductStockLevel(String id) throws IOException, InterruptedException, ExecutionException {
        String jwt = generateJWT(secretKey);
        String apiEndpoint = this.apiEndpoint + "/inventory/" + id;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiEndpoint))
                .version(HttpClient.Version.HTTP_1_1)
                .header("Authorization", "Bearer " + jwt)
                .header("Accept", "application/json")     // Add Accept header
                .header("Content-Type", "application/json") // Add Content-Type header
                .timeout(Duration.ofSeconds(HTTP_TIMEOUT))
                .GET()
                .build();

        System.out.println(String.format("First attempt to get stock level for product: %s", id));
        var httpResult = this.httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(httpResult.body());
        ApiResponse<ProductDTO> stockLevelResponse = null;

        TypeReference<ApiResponse<ProductDTO>> typeRef = new TypeReference<ApiResponse<ProductDTO>>(){};
        stockLevelResponse = objectMapper.readValue(httpResult.body(), typeRef);

        var success = false;

        if (stockLevelResponse.getData() != null){
            success = true;
        }

        var maxRetries = MAX_RETRIES;
        while (!success && maxRetries > 0) {
            System.out.println(String.format("Attempt %d to get stock level for product: %s", maxRetries, id));

            Thread.sleep(SLEEP_TIME_BETWEEN_RETRIES);

            httpResult = this.httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            System.out.println(httpResult.body());
            stockLevelResponse = objectMapper.readValue(httpResult.body(), typeRef);
            System.out.println(String.format("Response received for product: %s", httpResult.statusCode()));

            if (stockLevelResponse.getData() != null){
                success = true;
            }

            maxRetries--;
        }

        return stockLevelResponse;
    }

    public HttpResponse<String> updateStockLevel(UpdateStockLevelCommand command) throws IOException, InterruptedException, ExecutionException {
        String jwt = generateJWT(secretKey);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(this.apiEndpoint + "/inventory/"))
                .version(HttpClient.Version.HTTP_1_1)
                .header("Authorization", "Bearer " + jwt)
                .header("Accept", "application/json")     // Add Accept header
                .header("Content-Type", "application/json") // Add Content-Type header
                .timeout(Duration.ofSeconds(HTTP_TIMEOUT))
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(command)))
                .build();

        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    public void injectProductCreatedEvent(String productId) throws JsonProcessingException {
        ProductCreatedEventV1 event = new ProductCreatedEventV1();
        event.setProductId(productId);

        CloudEventWrapper<ProductCreatedEventV1> cloudEvent = new CloudEventWrapper<>();
        cloudEvent.setData(event);

        String message = objectMapper.writeValueAsString(cloudEvent);
        String detailType = "product.productCreated.v1";
        String source = String.format("%s.products", System.getenv("ENV"));

        PutEventsRequestEntry entry = PutEventsRequestEntry.builder()
                .detail(message)
                .detailType(detailType)
                .eventBusName(busName)
                .source(source)
                .build();

        PutEventsRequest request = PutEventsRequest.builder().entries(entry).build();
        PutEventsResponse response = eventBridgeClient.putEvents(request);

        if (response.failedEntryCount() > 0) {
            throw new RuntimeException("Failed to publish event");
        }
    }

    private String generateJWT(String secretKey) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("sub", "admin@serverless-sample.com");
        claims.put("user_type", "ADMIN");
        claims.put("exp", new Date(System.currentTimeMillis() + 3600000)); // 1 hour expiration
        claims.put("iat", new Date(System.currentTimeMillis()));

        return Jwts.builder()
                .setClaims(claims)
                .signWith(SignatureAlgorithm.HS256, secretKey.getBytes())
                .compact();
    }
}
