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
public class SnsMessageDetails implements Serializable {
    @JsonProperty("TopicArn")
    private String topicArn;
    
    @JsonProperty("Message")
    private String message;

    public SnsMessageDetails() {
    }

    public SnsMessageDetails(String topicArn, String message) {
        this.topicArn = topicArn;
        this.message = message;
    }

    public String getTopicArn() {
        return topicArn;
    }

    public String getMessage() {
        return message;
    }
}
