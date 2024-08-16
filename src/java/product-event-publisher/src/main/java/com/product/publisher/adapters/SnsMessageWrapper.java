/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.publisher.adapters;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.io.Serializable;

@JsonIgnoreProperties(ignoreUnknown = true)
public class SnsMessageWrapper<T> implements Serializable {
    @JsonProperty("Message")
    private T message;
    
    @JsonProperty("TopicArn")
    private String topicArn;

    public SnsMessageWrapper() {
    }

    public SnsMessageWrapper(T message) {
        this.message = message;
    }

    public T getMessage() {
        return message;
    }

    public String getTopicArn() {
        return topicArn;
    }
}
