/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core;

public interface EventPublisher {
    void publishNewProductAddedEvent(NewProductAddedEvent evt);

    void publishInventoryStockUpdatedEvent(InventoryStockUpdatedEvent evt);

    void publishStockReservedEvent(StockReservedEventV1 evt, String conversationId);

    void publishStockReservationFailedEvent(StockReservationFailedEventV1 evt, String conversationId);
}
