package com.inventory.core.adapters;

import com.fasterxml.jackson.annotation.JsonProperty;

public class DatadogTelemetry {
    @JsonProperty("traceparent")
    private String traceparent;

    public String getTraceparent() {
        return traceparent;
    }

    public void setTraceparent(String traceparent) {
        this.traceparent = traceparent;
    }
}
