package com.orders.application;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;

public class SnsMessageWrapper implements Serializable {
    private static final long serialVersionUID = 1L;

    @JsonProperty("Message")
    private String message = null;

    public SnsMessageWrapper() {
    }

    public SnsMessageWrapper(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
