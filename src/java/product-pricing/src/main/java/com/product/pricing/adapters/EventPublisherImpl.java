/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.pricing.adapters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.pricing.core.EventPublisher;
import com.product.pricing.core.ProductPriceCalculatedEvent;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;

import java.util.Collections;

@Component
public class EventPublisherImpl implements EventPublisher {
    private final SnsClient sns;
    private final ObjectMapper mapper;
    private final Logger logger = LoggerFactory.getLogger(EventPublisherImpl.class);

    public EventPublisherImpl(SnsClient sns, ObjectMapper mapper) {
        this.sns = sns;
        this.mapper = mapper;
    }

    @Override
    public void publishPriceCalculatedEvent(ProductPriceCalculatedEvent evt) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            sns.publish(PublishRequest.builder()
                    .topicArn(System.getenv("PRICE_CALCULATED_TOPIC_ARN"))
                    .message(this.mapper.writeValueAsString(evt))
                    .build());
        }
        catch (JsonProcessingException exception) {
            logger.error("An exception occurred!", exception);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, exception));
        }
    }
}
