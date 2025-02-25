package com.inventory.api.driver;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;

public class CloudEventWrapper<T> implements Serializable {
    @JsonProperty("data")
    private T data;

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }
}
