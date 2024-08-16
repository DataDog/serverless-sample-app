/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.acl.adapters;

import com.amazonaws.services.sns.AmazonSNS;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.acl.core.EventPublisher;

import com.inventory.acl.core.events.internal.NewProductAddedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class EventPublisherImpl implements EventPublisher {
    private final AmazonSNS snsClient;
    private final ObjectMapper mapper;
    private final Logger logger = LoggerFactory.getLogger(EventPublisher.class);

    public EventPublisherImpl(AmazonSNS snsClient, ObjectMapper mapper) {
        this.snsClient = snsClient;
        this.mapper = mapper;
    }

    @Override
    public void publishNewProductAddedEvent(NewProductAddedEvent evt) {
        try {
            this.snsClient.publish(System.getenv("NEW_PRODUCT_ADDED_TOPIC_ARN"), this.mapper.writeValueAsString(evt));

        }
        catch (JsonProcessingException exception) {
        }
    }
}
