/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core.config;

import jakarta.enterprise.context.ApplicationScoped;

import java.util.Optional;

import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Centralized application configuration using Quarkus config properties
 * instead of direct environment variable access for better testability 
 * and configuration management.
 */
@ApplicationScoped
public class AppConfig {
    
    @ConfigProperty(name = "table.name", defaultValue = "InventoryTable")
    String tableName;
    
    @ConfigProperty(name = "product.added.topic.arn", defaultValue = "product-created-topic")
    String productAddedTopicArn;
    
    @ConfigProperty(name = "event.bus.name", defaultValue = "default")
    String eventBusName;
    
    @ConfigProperty(name = "domain", defaultValue = "inventory")
    String domain;
    
    @ConfigProperty(name = "env", defaultValue = "dev")
    String environment;
    
    @ConfigProperty(name = "dd.service", defaultValue = "inventory")
    String ddService;
    
    @ConfigProperty(name = "aws.sdk.max.connections", defaultValue = "50")
    int awsMaxConnections;
    
    @ConfigProperty(name = "aws.sdk.connection.timeout.ms", defaultValue = "3000")
    int awsConnectionTimeoutMs;
    
    @ConfigProperty(name = "aws.sdk.connection.ttl.ms", defaultValue = "60000")
    int awsConnectionTtlMs;
    
    @ConfigProperty(name = "cache.inventory.ttl.seconds", defaultValue = "60")
    int inventoryCacheTtlSeconds;
    
    @ConfigProperty(name = "aws.sdk.retry.count", defaultValue = "3")
    int awsRetryCount;

    public String getTableName() {
        return tableName;
    }

    public String getProductAddedTopicArn() {
        return productAddedTopicArn;
    }

    public String getEventBusName() {
        return eventBusName;
    }

    public String getDomain() {
        return domain;
    }

    public String getEnvironment() {
        return environment;
    }

    public String getDdService() {
        return ddService;
    }
    
    public int getAwsMaxConnections() {
        return awsMaxConnections;
    }
    
    public int getAwsConnectionTimeoutMs() {
        return awsConnectionTimeoutMs;
    }
    
    public int getAwsConnectionTtlMs() {
        return awsConnectionTtlMs;
    }
    
    public int getInventoryCacheTtlSeconds() {
        return inventoryCacheTtlSeconds;
    }
    
    public int getAwsRetryCount() {
        return awsRetryCount;
    }
    
    public String getSource() {
        return String.format("%s.inventory", environment);
    }
} 