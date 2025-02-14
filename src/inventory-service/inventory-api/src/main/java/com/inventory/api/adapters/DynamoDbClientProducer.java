/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2025 Datadog, Inc.
 */

package com.inventory.api.adapters;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import org.jboss.logging.Logger;
import software.amazon.awssdk.http.crt.AwsCrtHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.DynamoDbClientBuilder;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.net.URI;
import java.time.Duration;

@ApplicationScoped
public class DynamoDbClientProducer {
    private static final Logger LOGGER = Logger.getLogger("Listener");
    private static final DynamoDbClient CLIENT;
    
    static {
        LOGGER.info("Creating DynamoDB client");
        String environment = System.getenv("ENV");
        
        DynamoDbClientBuilder builder = DynamoDbClient.builder()
                .httpClientBuilder(AwsCrtHttpClient.builder()
                        .connectionTimeout(Duration.ofSeconds(3))
                        .maxConcurrency(100));

        if ("local".equalsIgnoreCase(environment) || environment == null) {
            builder.endpointOverride(URI.create("http://localhost:4566"))
                    .region(Region.US_EAST_1); // Local region for DynamoDB Local
        } else {
            builder.region(Region.of(System.getenv("AWS_REGION"))); // AWS region for production
        }

        var client = builder.build();

        if ("local".equalsIgnoreCase(environment) || environment == null) {
            try {
                client.createTable(CreateTableRequest.builder()
                        .tableName(System.getenv("TABLE_NAME"))
                        .keySchema(KeySchemaElement.builder()
                                .attributeName("PK")
                                .keyType(KeyType.HASH)
                                .build())
                        .attributeDefinitions(AttributeDefinition.builder()
                                .attributeName("PK")
                                .attributeType(ScalarAttributeType.S)
                                .build())
                        .billingMode(BillingMode.PAY_PER_REQUEST)
                        .tableClass(TableClass.STANDARD)
                        .build());
            }
            catch (Exception e){
            }
        } else {
            // Prime SDK client
            client.describeEndpoints();
        }
        
        CLIENT = client;
    }

    @Produces
    @ApplicationScoped
    public DynamoDbClient createDynamoDbClient() {
        return CLIENT;
    }
}
