/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2025 Datadog, Inc.
 */

package com.product.api.container;

import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.jboss.logging.Logger;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.sns.SnsClient;

@ApplicationScoped
public class AppLifecycle {
    @Inject
    DynamoDbClient dynamoDbClient;
    @Inject
    SnsClient snsClient;
    
    private static final Logger LOGGER = Logger.getLogger("Listener");

    void onStart(@Observes StartupEvent ev) {
        if (!"local".equalsIgnoreCase(System.getenv("env"))) {
            LOGGER.info("Priming AWS SDKs...");
            try {
                dynamoDbClient.describeTable(r -> r.tableName(System.getenv("TABLE_NAME")));

                snsClient.listTopics();
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
