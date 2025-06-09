package com.inventory.core.adapters;

import datadog.trace.api.experimental.DataStreamsContextCarrier;

import java.util.Map;
import java.util.Set;

public class Carrier implements DataStreamsContextCarrier {
    private Headers headers;

    public Carrier(Headers headers) {
        this.headers = headers;
    }

    public Set<Map.Entry<String, Object>> entries() {
        return this.headers.entrySet();
    }

    public void set(String key, String value){
        this.headers.put(key, value);
    }
}

