/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2025 Datadog, Inc.
 */

package com.inventory.api;

import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.eventbridge.EventBridgeClient;
import software.amazon.awssdk.services.eventbridge.model.ListEventBusesRequest;

@ApplicationScoped
public class AppLifecycle {
    @Inject
    DynamoDbClient dynamoDbClient;
    @Inject
    EventBridgeClient eventBridgeClient;
    
    private static final Logger LOGGER = Logger.getLogger("Listener");

    void onStart(@Observes StartupEvent ev) {
        LOGGER.info("The application is starting...");
        if (!"local".equalsIgnoreCase(System.getenv("ENV"))) {
            LOGGER.info("Priming AWS SDKs...");
            try {
                dynamoDbClient.describeTable(r -> r.tableName(System.getenv("TABLE_NAME")));

                eventBridgeClient.listEventBuses(ListEventBusesRequest.builder().build());
            }
            catch (Exception e) {
                LOGGER.warn("Failed to prime AWS SDKs. This may be expected if the resources do not exist yet.");
                LOGGER.warn(e);
            }
        }
        
        LOGGER.info("The application is starting...");
    }

    void onStop(@Observes ShutdownEvent ev) {
        LOGGER.info("The application is stopping...");
    }

}
