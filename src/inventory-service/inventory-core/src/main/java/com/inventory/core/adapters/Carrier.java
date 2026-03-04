package com.inventory.core.adapters;

import datadog.trace.api.experimental.DataStreamsContextCarrier;

import java.util.Map;
import java.util.Set;

public class Carrier implements DataStreamsContextCarrier {
    private final DatadogTelemetry datadog;

    public Carrier(DatadogTelemetry datadog) {
        this.datadog = datadog;
    }

    @Override
    public Set<Map.Entry<String, Object>> entries() {
        return this.datadog.getContext().entrySet();
    }

    @Override
    public void set(String key, String value) {
        this.datadog.setContextEntry(key, value);
    }
}
