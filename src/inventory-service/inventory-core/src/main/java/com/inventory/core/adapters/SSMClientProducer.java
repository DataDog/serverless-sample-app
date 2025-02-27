/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2025 Datadog, Inc.
 */

package com.inventory.core.adapters;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import org.jboss.logging.Logger;
import software.amazon.awssdk.http.crt.AwsCrtHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.DynamoDbClientBuilder;
import software.amazon.awssdk.services.dynamodb.model.*;
import software.amazon.awssdk.services.ssm.SsmClient;

import java.net.URI;
import java.time.Duration;

@ApplicationScoped
public class SSMClientProducer {
    private static final Logger LOGGER = Logger.getLogger("Listener");
    private static final SsmClient CLIENT;
    
    static {
        LOGGER.info("Creating SSM client");
        String environment = System.getenv("ENV");
        
        SsmClient client = SsmClient.builder()
                .httpClientBuilder(AwsCrtHttpClient.builder()
                        .connectionTimeout(Duration.ofSeconds(3))
                        .maxConcurrency(100))
                .region(Region.of(System.getenv("AWS_REGION")))
                .build();
        
        CLIENT = client;
    }

    @Produces
    @ApplicationScoped
    public SsmClient createSsmClient() {
        return CLIENT;
    }
}
