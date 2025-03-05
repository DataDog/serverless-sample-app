package com.inventory.core;

import java.util.ArrayList;

public interface OrderCache {
    ArrayList<String> products(String orderId);
    void store(String orderId, ArrayList<String> products);
}
