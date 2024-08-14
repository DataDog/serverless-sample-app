package com.product.api.core;

import java.util.List;

public class HandlerResponse<T> {
    private final T data;
    private final List<String> message;
    private final boolean success;

    public HandlerResponse(T data, List<String> message, boolean success) {
        this.data = data;
        this.message = message;
        this.success = success;
    }

    public boolean isSuccess() {
        return success;
    }

    public List<String> getMessage() {
        return message;
    }

    public T getData() {
        return data;
    }
}
