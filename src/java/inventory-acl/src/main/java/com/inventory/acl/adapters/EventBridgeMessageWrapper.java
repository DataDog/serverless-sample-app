/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.acl.adapters;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;

public class EventBridgeMessageWrapper<T> implements Serializable {
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
