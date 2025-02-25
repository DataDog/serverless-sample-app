package com.inventory.api.driver;

import java.util.List;

public class ApiResponse<T> {
    private T data;
    private List<String> message;

    public T getData() {
        return data;
    }

    public List<String> getMessage() {
        return message;
    }

    // Getters and setters
}

