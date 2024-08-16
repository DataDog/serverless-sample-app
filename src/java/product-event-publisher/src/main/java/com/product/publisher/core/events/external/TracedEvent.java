/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.publisher.core.events.external;

import io.opentracing.Span;

import java.io.Serializable;

public class TracedEvent implements Serializable {
    private final String traceId;
    private final String spanId;
    
    TracedEvent(Span currentSpan){
        this.traceId = currentSpan.context().toTraceId();
        this.spanId = currentSpan.context().toSpanId();
    }

    public String getTraceId() {
        return traceId;
    }

    public String getSpanId() {
        return spanId;
    }
}
