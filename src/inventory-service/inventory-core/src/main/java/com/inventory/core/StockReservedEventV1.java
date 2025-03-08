/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class StockReservedEventV1 {
    private final String orderNumber;
    private final String conversationId;

    public StockReservedEventV1(){
        this.orderNumber = "";
        this.conversationId = "";
    }

    public StockReservedEventV1(String orderNumber, String conversationId) {
        this.orderNumber = orderNumber;
        this.conversationId = conversationId;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public String getConversationId() {
        return conversationId;
    }
}
