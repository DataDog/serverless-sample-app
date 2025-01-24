/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.container.core;

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
