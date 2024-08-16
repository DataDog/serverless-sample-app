/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.adapters;

import com.amazonaws.services.sns.AmazonSNS;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.api.core.EventPublisher;
import com.product.api.core.ProductCreatedEvent;
import com.product.api.core.ProductDeletedEvent;
import com.product.api.core.ProductUpdatedEvent;

import org.springframework.stereotype.Component;

@Component
public class EventPublisherImpl implements EventPublisher {
    private final AmazonSNS sns;
    private final ObjectMapper mapper;

    public EventPublisherImpl(AmazonSNS sns, ObjectMapper mapper) {
        this.sns = sns;
        this.mapper = mapper;
    }

    @Override
    public boolean publishProductCreatedEvent(ProductCreatedEvent evt) {
        try {
            sns.publish(System.getenv("PRODUCT_CREATED_TOPIC_ARN"), this.mapper.writeValueAsString(evt));
            
            return true;
        }
        catch (JsonProcessingException exception) {
            return false;
        }
    }

    @Override
    public boolean publishProductUpdatedEvent(ProductUpdatedEvent evt) {
        try {
            sns.publish(System.getenv("PRODUCT_UPDATED_TOPIC_ARN"), this.mapper.writeValueAsString(evt));

            return true;
        }
        catch (JsonProcessingException exception) {
            return false;
        }
    }

    @Override
    public boolean publishProductDeletedEvent(ProductDeletedEvent evt) {
        try {
            sns.publish(System.getenv("PRODUCT_DELETED_TOPIC_ARN"), this.mapper.writeValueAsString(evt));

            return true;
        }
        catch (JsonProcessingException exception) {
            return false;
        }
    }
}
