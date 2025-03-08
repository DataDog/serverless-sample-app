package com.inventory.ordering.adapters;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.opentracing.util.GlobalTracer;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

public class CloudEventWrapper<T> implements Serializable {
    @JsonProperty("id")
    private String id;
    @JsonProperty("source")
    private String source;
    @JsonProperty("type")
    private String type;
    @JsonProperty("time")
    private String time;
    @JsonProperty("traceparent")
    private String traceparent;
    @JsonProperty("data")
    private T data;

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public String getId() {
        return id;
    }

    public String getSource() {
        return source;
    }

    public String getType() {
        return type;
    }

    public String getTime() {
        return time;
    }

    public String getTraceparent() {
        return traceparent;
    }
}
