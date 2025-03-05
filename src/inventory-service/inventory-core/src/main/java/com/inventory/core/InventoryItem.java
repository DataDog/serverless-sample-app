/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core;

import io.quarkus.runtime.annotations.RegisterForReflection;
import software.amazon.awssdk.services.sns.endpoints.internal.Value;

import java.util.ArrayList;
import java.util.List;

@RegisterForReflection
public class InventoryItem {
    private String productId;
    private Double currentStockLevel;
    private Double reservedStockLevel;
    private ArrayList<String> reservedStockOrders;

    public InventoryItem() {
        this.productId = "";
        this.currentStockLevel = -1.0;
        this.reservedStockLevel = 0.0;
        this.reservedStockOrders = new ArrayList<>();
    }

    public InventoryItem(String productId, Double currentStockLevel, Double reservedStockLevel, ArrayList<String> reservedStockOrders) {
        this.productId = productId;
        this.currentStockLevel = currentStockLevel;
        this.reservedStockLevel = reservedStockLevel;
        this.reservedStockOrders = reservedStockOrders;
    }

    static InventoryItem Create(String productId, Double currentStockLevel) {
        InventoryItem inventoryItem = new InventoryItem();
        inventoryItem.productId = productId;
        inventoryItem.currentStockLevel = currentStockLevel;
        inventoryItem.reservedStockLevel = 0.0;
        inventoryItem.reservedStockOrders = new ArrayList<>();
        return inventoryItem;
    }

    public String getProductId() {
        return productId;
    }

    public Double getCurrentStockLevel() {
        return currentStockLevel;
    }

    public void setCurrentStockLevel(Double currentStockLevel) {
        this.currentStockLevel = currentStockLevel;
    }

    public Double getReservedStockLevel() {
        return reservedStockLevel;
    }

    public List<String> getReservedStockOrders() {
        return reservedStockOrders;
    }

    public Double getAvailableStockLevel() {
        return this.currentStockLevel - this.reservedStockLevel;
    }

    public void reserveStockFor(String orderId) {
        if (this.reservedStockOrders.contains(orderId)) {
            return;
        }

        this.reservedStockOrders.add(orderId);
        this.reservedStockLevel = reservedStockLevel + 1.0;
    }

    public void releaseStockFor(String orderId) {
        if (!this.reservedStockOrders.contains(orderId)) {
            return;
        }
        this.reservedStockOrders.remove(orderId);
        this.reservedStockLevel = reservedStockLevel - 1.0;
    }

    public void stockDispatchedFor(String orderId) {
        if (!this.reservedStockOrders.contains(orderId)) {
            return;
        }
        this.reservedStockOrders.remove(orderId);
        this.reservedStockLevel = reservedStockLevel - 1.0;
        this.currentStockLevel = this.currentStockLevel - 1.0;
    }
}
