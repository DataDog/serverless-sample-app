/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core;

public interface InventoryItemRepository {
    InventoryItem withProductId(String productId) throws DataAccessException, InventoryItemNotFoundException;
    void update(InventoryItem item) throws DataAccessException;
}
