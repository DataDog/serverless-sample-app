package com.inventory.core.adapters;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

public class Headers {
    private final Map<String, Object> headers = new HashMap<>();

    public Set<Map.Entry<String, Object>> entrySet() {
        return headers.entrySet();
    }

    public void put(String key, String value) {
        headers.put(key, value);
    }
}
