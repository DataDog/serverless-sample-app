/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.publisher.adapters;

import com.amazonaws.services.eventbridge.AmazonEventBridge;
import com.amazonaws.services.eventbridge.model.PutEventsRequest;
import com.amazonaws.services.eventbridge.model.PutEventsRequestEntry;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.publisher.core.EventPublisher;
import com.product.publisher.core.events.external.ProductCreatedEventV1;
import com.product.publisher.core.events.external.ProductDeletedEventV1;
import com.product.publisher.core.events.external.ProductUpdatedEventV1;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
public class EventPublisherImpl implements EventPublisher {
    private final AmazonEventBridge eventBridgeClient;
    private final ObjectMapper mapper;
    private final Logger logger = LoggerFactory.getLogger(EventPublisher.class);

    public EventPublisherImpl(AmazonEventBridge eventBridgeClient, ObjectMapper mapper) {
        this.eventBridgeClient = eventBridgeClient;
        this.mapper = mapper;
    }

    @Override
    public void publishProductCreatedEvent(ProductCreatedEventV1 evt) {
        final Span span = GlobalTracer.get().activeSpan();
        
        try {
            String evtData = mapper.writeValueAsString(evt);

            this.publish("product.productCreated.v1", evtData);
        }
        catch (JsonProcessingException error){
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));
        }
    }

    @Override
    public void publishProductUpdatedEvent(ProductUpdatedEventV1 evt) {
        final Span span = GlobalTracer.get().activeSpan();

        try {
            String evtData = mapper.writeValueAsString(evt);

            this.publish("product.productUpdated.v1", evtData);
        }
        catch (JsonProcessingException error){
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));
        }
    }

    @Override
    public void publishProductDeletedEvent(ProductDeletedEventV1 evt) {
        final Span span = GlobalTracer.get().activeSpan();

        try {
            String evtData = mapper.writeValueAsString(evt);

            this.publish("product.productDeleted.v1", evtData);
        }
        catch (JsonProcessingException error){
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));
        }
    }
    
    private void publish(String detailType, String detail){
        final Span span = GlobalTracer.get().activeSpan();
        
        String source = String.format("%s.products", System.getenv("ENV"));
        String eventBusName = System.getenv("EVENT_BUS_NAME");
        
        span.setTag("messaging.source", source);
        span.setTag("messaging.detailType", detailType);
        span.setTag("messaging.eventBus", eventBusName);
        
        this.logger.info(String.format("Publishing %s from %s to %s", detailType, source, eventBusName));
        
        PutEventsRequest request = new PutEventsRequest()
                .withEntries(List.of(new PutEventsRequestEntry()
                        .withEventBusName(eventBusName)
                        .withSource(source)
                        .withDetailType(detailType)
                        .withDetail(detail)));
        
        eventBridgeClient.putEvents(request);
    }
}
