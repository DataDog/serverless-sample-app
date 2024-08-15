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
