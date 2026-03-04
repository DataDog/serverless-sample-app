package com.inventory.core.adapters;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

public class DatadogTelemetry {
    @JsonProperty("traceparent")
    private String traceparent;

    // Holds DSM context entries (e.g. "dd-pathway-ctx") serialised flat
    // alongside traceparent inside the _datadog envelope.
    private final Map<String, Object> context = new HashMap<>();

    public String getTraceparent() {
        return traceparent;
    }

    public void setTraceparent(String traceparent) {
        this.traceparent = traceparent;
    }

    @JsonAnyGetter
    public Map<String, Object> getContext() {
        return context;
    }

    @JsonAnySetter
    public void setContextEntry(String key, Object value) {
        context.put(key, value);
    }
}
