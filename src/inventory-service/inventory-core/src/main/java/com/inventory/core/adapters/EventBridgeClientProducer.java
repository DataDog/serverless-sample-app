/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2025 Datadog, Inc.
 */

package com.inventory.core.adapters;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import software.amazon.awssdk.http.crt.AwsCrtHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.eventbridge.EventBridgeClient;
import software.amazon.awssdk.services.eventbridge.model.ListEventBusesRequest;

import java.time.Duration;

@ApplicationScoped
public class EventBridgeClientProducer {

    @Produces
    @ApplicationScoped
    public EventBridgeClient eventBridgeClientProducer() {
        var client = EventBridgeClient.builder()
                .region(Region.of(System.getenv("AWS_REGION")))
                .httpClientBuilder(AwsCrtHttpClient
                        .builder()
                        .connectionTimeout(Duration.ofSeconds(3))
                        .maxConcurrency(100))
                .build();

        client.listEventBuses(ListEventBusesRequest.builder().build());
        
        return client;
    }
}
