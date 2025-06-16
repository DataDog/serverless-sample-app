package com.inventory.acl.adapters;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;

public class CloudEventWrapper<T> implements Serializable {
    @JsonProperty("data")
    private T data;

    @JsonProperty("conversationId")
    private String conversationId;

    @JsonProperty("type")
    private String type;

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

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}
