package com.inventory.api;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.api.driver.ApiDriver;
import com.inventory.api.driver.UpdateStockLevelCommand;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.http.crt.AwsCrtHttpClient;
import software.amazon.awssdk.services.eventbridge.EventBridgeClient;
import software.amazon.awssdk.services.ssm.SsmClient;

import java.io.IOException;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

class ProductResourceTest {
    ApiDriver apiDriver;
    ObjectMapper objectMapper;
    static final int WORKFLOW_MINIMUM_EXECUTION=15000;
    static final int ORDER_CREATED_PROCESSING_DELAY=10000;

    @BeforeEach
    public void setup() {
        objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        SsmClient ssmClient = SsmClient.builder()
                .httpClientBuilder(AwsCrtHttpClient.builder()
                        .connectionTimeout(Duration.ofSeconds(3))
                        .maxConcurrency(100))
                .build();

        EventBridgeClient eventBridgeClient = EventBridgeClient.builder()
                .httpClientBuilder(AwsCrtHttpClient.builder()
                        .connectionTimeout(Duration.ofSeconds(3))
                        .maxConcurrency(100))
                .build();

        apiDriver = new ApiDriver(System.getenv("ENV"), ssmClient, eventBridgeClient, objectMapper);
    }

    @Test
    public void test_when_product_created_event_received_product_is_available_through_api() throws IOException, ExecutionException, InterruptedException {
            var randomProductId = UUID.randomUUID().toString();

            apiDriver.injectProductCreatedEvent(randomProductId);

            Thread.sleep(WORKFLOW_MINIMUM_EXECUTION);

            var stockLevel = apiDriver.getProductStockLevel(randomProductId);

            Assertions.assertNotNull(stockLevel.getData());
            Assertions.assertEquals(randomProductId, stockLevel.getData().getProductId());
    }

    @Test
    public void test_product_stock_levels_can_be_updated() throws IOException, ExecutionException, InterruptedException {
        var randomProductId = UUID.randomUUID().toString();

        apiDriver.injectProductCreatedEvent(randomProductId);

        Thread.sleep(WORKFLOW_MINIMUM_EXECUTION);

        var stockLevel = apiDriver.getProductStockLevel(randomProductId);
        Assertions.assertEquals(randomProductId, stockLevel.getData().getProductId());

        var updateStockLevelResult = apiDriver.updateStockLevel(new UpdateStockLevelCommand(randomProductId, 10.0));

        Assertions.assertEquals(200, updateStockLevelResult.statusCode());

        stockLevel = apiDriver.getProductStockLevel(randomProductId);

        Assertions.assertNotNull(stockLevel.getData());
        Assertions.assertEquals(10.0, stockLevel.getData().getCurrentStockLevel());
    }


    @Test
    public void test_stock_levels_are_decreased_when_order_created() throws IOException, ExecutionException, InterruptedException {
        var randomProductId = UUID.randomUUID().toString();

        apiDriver.injectProductCreatedEvent(randomProductId);

        Thread.sleep(WORKFLOW_MINIMUM_EXECUTION);

        var stockLevel = apiDriver.getProductStockLevel(randomProductId);
        Assertions.assertEquals(randomProductId, stockLevel.getData().getProductId());

        var updateStockLevelResult = apiDriver.updateStockLevel(new UpdateStockLevelCommand(randomProductId, 10.0));

        Assertions.assertEquals(200, updateStockLevelResult.statusCode());

        stockLevel = apiDriver.getProductStockLevel(randomProductId);

        Assertions.assertEquals(10.0, stockLevel.getData().getCurrentStockLevel());

        apiDriver.injectOrderCreatedEvent(randomProductId);

        Thread.sleep(ORDER_CREATED_PROCESSING_DELAY);

        stockLevel = apiDriver.getProductStockLevel(randomProductId);

        Assertions.assertEquals(9, stockLevel.getData().getCurrentStockLevel());
        Assertions.assertEquals(1, stockLevel.getData().getReservedStockLevel());
    }
}