package com.orders.application.core;

public class Order {
    private final String orderId;
    
    public Order(){
        orderId = "";
    }

    public Order(String orderId) {
        this.orderId = orderId;
    }

    public String getOrderId() {
        return orderId;
    }
}
