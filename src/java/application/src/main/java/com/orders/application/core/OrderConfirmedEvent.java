package com.orders.application.core;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderConfirmedEvent {
    private String orderId;

    public OrderConfirmedEvent(){
        this.orderId = "";
    }
    
    public OrderConfirmedEvent(String orderId) {
        this.orderId = orderId;
    }

    public String getOrderId() {
        return orderId;
    }
}
