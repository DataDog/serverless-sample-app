package com.inventory.ordering;

import datadog.trace.api.experimental.DataStreamsContextCarrier;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

public class Carrier implements DataStreamsContextCarrier {
    private final Map<String, Object> map = new HashMap<>();

    @Override
    public Set<Map.Entry<String, Object>> entries() {
        return map.entrySet();
    }

    @Override
    public void set(String key, String value) {
        map.put(key, value);
    }
}
