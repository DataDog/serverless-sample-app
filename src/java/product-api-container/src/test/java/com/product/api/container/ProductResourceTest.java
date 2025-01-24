package com.product.api.container;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.api.container.adapters.DynamoDbClientProducer;
import com.product.api.container.adapters.EventPublisherImpl;
import com.product.api.container.adapters.ProductRepositoryImpl;
import com.product.api.container.core.ProductService;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

@QuarkusTest
@Testcontainers
class ProductResourceTest {
    @Container
    public GenericContainer dynamoDb = new GenericContainer(DockerImageName.parse("amazon/dynamodb-local:1.19.0"))
            .withCommand("-jar DynamoDBLocal.jar -inMemory -sharedDb");
    
    public ProductService productService;
    
    @BeforeEach
    public void setup() {
        ObjectMapper objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        DynamoDbClientProducer producer = new DynamoDbClientProducer();
        DynamoDbClient client = producer.createDynamoDbClient();
        productService = new ProductService(new ProductRepositoryImpl(client, objectMapper), new TestEventPublisher());
    }

}