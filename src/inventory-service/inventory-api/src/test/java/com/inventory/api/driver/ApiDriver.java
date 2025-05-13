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
import java.util.*;
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
        String serviceName = Objects.equals(env, "dev") || Objects.equals(env, "prod") ? "shared" : "InventoryService";

        System.out.println("Env: " + env);
        System.out.println("Service Name: " + serviceName);

        this.apiEndpoint = getParameterValue(ssmClient, String.format("/%s/InventoryService/api-endpoint", env));
        this.secretKey = getParameterValue(ssmClient, String.format("/%s/%s/secret-access-key", env, serviceName));
        this.busName = getParameterValue(ssmClient, String.format("/%s/%s/event-bus-name", env, serviceName));
    }

    private String getParameterValue(SsmClient ssmClient, String paramName) {
        System.out.println("Getting parameter: " + paramName);
        GetParameterRequest request = GetParameterRequest.builder().name(paramName).withDecryption(true).build();
        GetParameterResponse response = ssmClient.getParameter(request);
        return response.parameter().value();
    }

    public ApiResponse<InventoryItemDTO> getProductStockLevel(String id, int expectedStockLevel) throws IOException, InterruptedException, ExecutionException {
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

        var httpResult = this.httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(httpResult.body());
        ApiResponse<InventoryItemDTO> stockLevelResponse = null;

        TypeReference<ApiResponse<InventoryItemDTO>> typeRef = new TypeReference<ApiResponse<InventoryItemDTO>>(){};
        stockLevelResponse = objectMapper.readValue(httpResult.body(), typeRef);

        var success = false;
        success = validateStockLevelInResponse(expectedStockLevel, stockLevelResponse);

        var maxRetries = MAX_RETRIES;
        while (!success && maxRetries > 0) {
            Thread.sleep(SLEEP_TIME_BETWEEN_RETRIES);

            httpResult = this.httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            System.out.println("Response for product..." + id);
            System.out.println(httpResult.body());
            stockLevelResponse = objectMapper.readValue(httpResult.body(), typeRef);

            success = validateStockLevelInResponse(expectedStockLevel, stockLevelResponse);

            maxRetries--;
        }

        return stockLevelResponse;
    }

    private static boolean validateStockLevelInResponse(int expectedStockLevel, ApiResponse<InventoryItemDTO> stockLevelResponse) {
        boolean success = false;
        if (stockLevelResponse.getData() != null){
            // If a value of less than 0 is passed in the stock level doesn't matter
            if (expectedStockLevel < 0){
                System.out.println("Expected stock level is less than 0, so we don't care what the value is");
                success = true;
            }

            // If a stock level is passed in, make sure that it is validated
            if (stockLevelResponse.getData().getCurrentStockLevel() == expectedStockLevel){
                System.out.println("Expected stock level is equal to current stock level");
                success = true;
            } else {
                System.out.println("Expected stock level is not equal to current stock level, retrying...");
            }
        }
        return success;
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

    public void injectOrderCompletedEvent(String orderNumber) throws JsonProcessingException {
        OrderCompletedEventV1 event = new OrderCompletedEventV1();
        event.setOrderNumber(orderNumber);

        CloudEventWrapper<OrderCompletedEventV1> cloudEvent = new CloudEventWrapper<>();
        cloudEvent.setData(event);

        String message = objectMapper.writeValueAsString(cloudEvent);
        String detailType = "orders.orderCompleted.v1";
        String source = String.format("%s.orders", System.getenv("ENV"));

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

    public void injectOrderCreatedEvent(String productId, String orderNumber) throws JsonProcessingException {
        OrderCreatedEventV1 event = new OrderCreatedEventV1();
        event.setOrderNumber(orderNumber);
        event.setProducts(List.of(productId));

        CloudEventWrapper<OrderCreatedEventV1> cloudEvent = new CloudEventWrapper<>();
        cloudEvent.setData(event);

        String message = objectMapper.writeValueAsString(cloudEvent);
        String detailType = "orders.orderCreated.v1";
        String source = String.format("%s.orders", System.getenv("ENV"));

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
