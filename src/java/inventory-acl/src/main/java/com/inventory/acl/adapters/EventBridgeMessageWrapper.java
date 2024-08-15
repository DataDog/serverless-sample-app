package com.inventory.acl.adapters;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;

public class EventBridgeMessageWrapper<T> implements Serializable {
    private static final long serialVersionUID = 1L;

    @JsonProperty("detail")
    private T detail;
    @JsonProperty("detail-type")
    private String detailType;
    @JsonProperty("source")
    private String source;

    public EventBridgeMessageWrapper() {
    }

    public EventBridgeMessageWrapper(String source, String detailType, T detail) {
        this.source = source;
        this.detailType = detailType;
        this.detail = detail;
    }

    public T getDetail() {
        return detail;
    }

    public void setDetail(T detail) {
        this.detail = detail;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getDetailType() {
        return detailType;
    }

    public void setDetailType(String detailType) {
        this.detailType = detailType;
    }
}
