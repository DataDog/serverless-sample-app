package com.inventory.ordering;

import datadog.trace.api.experimental.DataStreamsContextCarrier;

import java.util.Map;
import java.util.Set;

public class Carrier implements DataStreamsContextCarrier {

    @Override
    public Set<Map.Entry<String, Object>> entries() {
        return Set.of();
    }

    @Override
    public void set(String s, String s1) {

    }
}
