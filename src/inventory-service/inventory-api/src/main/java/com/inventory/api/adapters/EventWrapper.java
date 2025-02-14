package com.inventory.api.adapters;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;

public class EventWrapper<T> implements Serializable {
    @JsonProperty("data")
    private T data;

    public EventWrapper(T data) {
        this.data = data;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}
