/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.analytics.adapters;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;

public class EventBridgeMessageWrapper implements Serializable {
    @JsonProperty("detail-type")
    private String detailType;

    @JsonProperty("source")
    private String source;
    
    @JsonProperty("detail")
    private TraceData detail;
    
    public EventBridgeMessageWrapper() {
    }

    public EventBridgeMessageWrapper(String source, String detailType, TraceData detail) {
        this.source = source;
        this.detailType = detailType;
        this.detail = detail;
    }

    public String getDetailType() {
        return detailType;
    }

    public void setDetailType(String detailType) {
        this.detailType = detailType;
    }

    public TraceData getTraceData() {
        return detail;
    }

    public void setTraceData(TraceData detail) {
        this.detail = detail;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }
}
