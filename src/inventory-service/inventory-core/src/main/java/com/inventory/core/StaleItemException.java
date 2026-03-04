/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core;

/**
 * Thrown when a DynamoDB conditional write fails due to a version mismatch,
 * indicating a concurrent modification (optimistic locking conflict).
 */
public class StaleItemException extends RuntimeException {
    private final String productId;

    public StaleItemException(String productId) {
        super("Concurrent modification detected for inventory item: " + productId);
        this.productId = productId;
    }

    public StaleItemException(String productId, Throwable cause) {
        super("Concurrent modification detected for inventory item: " + productId, cause);
        this.productId = productId;
    }

    public String getProductId() {
        return productId;
    }
}
