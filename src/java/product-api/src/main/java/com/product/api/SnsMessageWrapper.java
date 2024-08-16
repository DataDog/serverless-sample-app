/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api;

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
