package com.inventory.core.adapters;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.opentracing.util.GlobalTracer;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

public class CloudEventWrapper<T> implements Serializable {
    @JsonProperty("_datadog")
    private DatadogTelemetry datadog;
    @JsonProperty("id")
    private String id;
    @JsonProperty("source")
    private String source;
    @JsonProperty("conversationId")
    private String conversationId;
    @JsonProperty("type")
    private String type;
    @JsonProperty("time")
    private String time;
    @JsonProperty("traceparent")
    private String traceparent;
    @JsonProperty("data")
    private T data;

    public CloudEventWrapper() {}

    public CloudEventWrapper(String type, T data) {
        this.id = UUID.randomUUID().toString();
        this.source = String.format("%s.inventory", System.getenv("ENV"));
        this.type = type;
        this.time = LocalDateTime.now().toString();
        this.traceparent = String.format("00-%s-%s-01", GlobalTracer.get().activeSpan().context().toTraceId().toString(), GlobalTracer.get().activeSpan().context().toSpanId().toString());
        this.data = data;
    }

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

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
    }

    public String getTime() {
        return time;
    }

    public String getTraceparent() {

        if (datadog != null) {
            return datadog.getTraceparent();
        }
        else {
            return traceparent;
        }
    }

    public void setDatadog(DatadogTelemetry datadog) {
        this.datadog = datadog;
    }
}
