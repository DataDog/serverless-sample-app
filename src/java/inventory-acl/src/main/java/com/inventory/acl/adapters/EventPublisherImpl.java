/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.acl.adapters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.acl.core.EventPublisher;

import com.inventory.acl.core.events.internal.NewProductAddedEvent;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;

@Component
public class EventPublisherImpl implements EventPublisher {
    private final SnsClient snsClient;
    private final ObjectMapper mapper;

    public EventPublisherImpl(SnsClient snsClient, ObjectMapper mapper) {
        this.snsClient = snsClient;
        this.mapper = mapper;
    }

    @Override
    public void publishNewProductAddedEvent(NewProductAddedEvent evt) {
        try {
            this.snsClient.publish(PublishRequest.builder()
                    .topicArn(System.getenv("PRODUCT_ADDED_TOPIC_ARN"))
                    .message(this.mapper.writeValueAsString(evt))
                    .build());

        } catch (JsonProcessingException exception) {
        }
    }
}
