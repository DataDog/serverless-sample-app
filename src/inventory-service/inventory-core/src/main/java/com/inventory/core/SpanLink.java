package com.inventory.core;

import datadog.trace.api.DDTraceId;

import java.util.Map;

public class SpanLink {
    public static final byte SAMPLED_FLAG = (byte) 0x01;
    public static final byte DEFAULT_FLAGS = (byte) 0x00;

    private final DDTraceId traceId;
    private final long spanId;
    private final byte traceFlags;
    private final String traceState;
    private final Map<String, Object> attributes;

    public SpanLink(
            DDTraceId traceId,
            long spanId,
            byte traceFlags,
            String traceState,
            Map<String, Object> attributes) {
        this.traceId = traceId == null ? DDTraceId.ZERO : traceId;
        this.spanId = spanId;
        this.traceFlags = traceFlags;
        this.traceState = traceState == null ? "" : traceState;
        this.attributes = attributes == null ? Map.of() : attributes;
    }

    public DDTraceId traceId() {
        return this.traceId;
    }

    public long spanId() {
        return this.spanId;
    }

    public byte traceFlags() {
        return this.traceFlags;
    }

    public String traceState() {
        return this.traceState;
    }

    public Map<String, Object> attributes() {
        return this.attributes;
    }

    @Override
    public String toString() {
        return "SpanLink{"
                + "traceId="
                + this.traceId
                + ", spanId="
                + this.spanId
                + ", traceFlags="
                + this.traceFlags
                + ", traceState='"
                + this.traceState
                + '\''
                + ", attributes="
                + this.attributes
                + '}';
    }
}
