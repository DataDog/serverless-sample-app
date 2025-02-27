package com.inventory.core.adapters;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;

public class EventWrapper<T> implements Serializable {
    @JsonProperty("data")
    private T data;

    @JsonProperty("conversationId")
    private String conversationId;

    public EventWrapper(T data) {
        this.data = data;
        this.conversationId = "";
    }

    public EventWrapper(T data, String conversationId) {
        this.data = data;
        this.conversationId = conversationId;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public String getConversationId() {
        return conversationId;
    }

    public void setConversationId(String conversationId) {
        this.conversationId = conversationId;
    }
}
