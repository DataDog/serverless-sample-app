/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.acl.adapters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.product.acl.core.EventPublisher;
import com.product.acl.core.events.internal.ProductStockUpdatedEvent;
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
    public void publishNewProductAddedEvent(ProductStockUpdatedEvent evt) {
        try {
            this.snsClient.publish(PublishRequest.builder()
                    .topicArn(System.getenv("PRODUCT_STOCK_UPDATED_TOPIC_ARN"))
                    .message(this.mapper.writeValueAsString(evt))
                    .build());

        } catch (JsonProcessingException exception) {
        }
    }
}
