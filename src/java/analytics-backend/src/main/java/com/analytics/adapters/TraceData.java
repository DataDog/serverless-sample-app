/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.analytics.adapters;

import java.io.Serializable;

public class TraceData implements Serializable {
    private final String traceId;
    private final String spanId;
    
    public TraceData(){
        this.traceId = "";
        this.spanId = "";
    }

    public String getTraceId() {
        return traceId;
    }

    public String getSpanId() {
        return spanId;
    }
}
