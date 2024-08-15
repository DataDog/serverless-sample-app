package com.analytics.adapters;

import java.io.Serializable;

public class TraceData implements Serializable {
    private String traceId;
    private String spanId;
    
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
