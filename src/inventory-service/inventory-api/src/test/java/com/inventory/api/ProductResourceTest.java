package com.inventory.api;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.api.adapters.DynamoDbClientProducer;
import com.inventory.api.adapters.InventoryItemRepositoryImpl;
import com.inventory.api.core.InventoryItem;
import com.inventory.api.core.InventoryItemRepository;
import com.inventory.api.core.InventoryItemService;
import com.inventory.api.core.UpdateInventoryStockRequest;
import io.quarkus.test.Mock;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

@QuarkusTest
@Testcontainers
class ProductResourceTest {
    @Container
    public GenericContainer dynamoDb = new GenericContainer(DockerImageName.parse("amazon/dynamodb-local:1.19.0"))
            .withCommand("-jar DynamoDBLocal.jar -inMemory -sharedDb");
    
    public InventoryItemService productService;
    public InventoryItemRepository repo;
    
    @BeforeEach
    public void setup() {
        ObjectMapper objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        repo = new MockInventoryItemRepository();

        productService = new InventoryItemService(repo, new TestEventPublisher());
    }

    @Test
    public void testGetProductById() {
        repo.update(new InventoryItem("TESTPRODUCT", 0.0));

        var stockRequest = new UpdateInventoryStockRequest();
        stockRequest.setProductId("TESTPRODUCT");
        stockRequest.setStockLevel(10.0);

        var result = productService.updateStock(stockRequest);

        // Act: Execute the method being tested

        // Assert: Verify the result
    }
}