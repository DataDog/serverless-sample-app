/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.container.adapters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.api.container.core.EventPublisher;
import com.product.api.container.core.ProductCreatedEvent;
import com.product.api.container.core.ProductDeletedEvent;
import com.product.api.container.core.ProductUpdatedEvent;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import jakarta.enterprise.context.ApplicationScoped;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;

import java.util.Collections;

@ApplicationScoped
public class EventPublisherImpl implements EventPublisher {
    private final SnsClient sns;
    private final ObjectMapper mapper;
    private final Logger logger = LoggerFactory.getLogger(EventPublisherImpl.class);

    public EventPublisherImpl(SnsClient sns, ObjectMapper mapper) {
        this.sns = sns;
        this.mapper = mapper;
    }

    @Override
    public void publishProductCreatedEvent(ProductCreatedEvent evt) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            sns.publish(PublishRequest.builder()
                    .topicArn(System.getenv("PRODUCT_CREATED_TOPIC_ARN"))
                    .message(this.mapper.writeValueAsString(evt))
                    .build());
        } catch (JsonProcessingException error) {
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));
        }
    }

    @Override
    public void publishProductUpdatedEvent(ProductUpdatedEvent evt) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            sns.publish(PublishRequest.builder()
                    .topicArn(System.getenv("PRODUCT_UPDATED_TOPIC_ARN"))
                    .message(this.mapper.writeValueAsString(evt))
                    .build());
        } catch (JsonProcessingException error) {
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));
        }
    }

    @Override
    public void publishProductDeletedEvent(ProductDeletedEvent evt) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            sns.publish(PublishRequest.builder()
                    .topicArn(System.getenv("PRODUCT_DELETED_TOPIC_ARN"))
                    .message(this.mapper.writeValueAsString(evt))
                    .build());
        } catch (JsonProcessingException error) {
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));
        }
    }
}
