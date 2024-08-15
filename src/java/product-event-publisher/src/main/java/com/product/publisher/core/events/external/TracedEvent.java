package com.product.publisher.core.events.external;

import io.opentracing.Span;

import java.io.Serializable;

public class TracedEvent implements Serializable {
    private String traceId;
    private String spanId;
    
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
