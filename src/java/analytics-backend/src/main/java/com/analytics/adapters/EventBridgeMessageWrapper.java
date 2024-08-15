package com.analytics.adapters;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;

public class EventBridgeMessageWrapper implements Serializable {
    @JsonProperty("detail-type")
    private String detailType;
    
    @JsonProperty("detail")
    private TraceData detail;
    
    public EventBridgeMessageWrapper() {
    }

    public EventBridgeMessageWrapper(String detailType, TraceData detail) {
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
}
