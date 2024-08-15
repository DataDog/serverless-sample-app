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
