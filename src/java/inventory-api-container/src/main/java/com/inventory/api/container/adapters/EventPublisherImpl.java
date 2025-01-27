/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.api.container.adapters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.api.container.core.EventPublisher;
import com.inventory.api.container.core.InventoryStockUpdatedEvent;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import jakarta.enterprise.context.ApplicationScoped;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.eventbridge.EventBridgeClient;
import software.amazon.awssdk.services.eventbridge.model.PutEventsRequest;
import software.amazon.awssdk.services.eventbridge.model.PutEventsRequestEntry;

import java.util.Collections;
import java.util.List;

@ApplicationScoped
public class EventPublisherImpl implements EventPublisher {
    private final EventBridgeClient eventBridge;
    private final ObjectMapper mapper;
    private final Logger logger = LoggerFactory.getLogger(EventPublisherImpl.class);

    public EventPublisherImpl(EventBridgeClient sns, ObjectMapper mapper) {
        this.eventBridge = sns;
        this.mapper = mapper;
    }

    @Override
    public void publishInventoryStockUpdatedEvent(InventoryStockUpdatedEvent evt) {
        final Span span = GlobalTracer.get().activeSpan();

        try {
            String evtData = mapper.writeValueAsString(evt);

            this.publish("inventory.stockUpdated.v1", evtData);
        }
        catch (JsonProcessingException error){
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));
        }
    }

    private void publish(String detailType, String detail){
        final Span span = GlobalTracer.get().activeSpan();

        String source = String.format("%s.inventory", System.getenv("ENV"));
        String eventBusName = System.getenv("EVENT_BUS_NAME");

        span.setTag("messaging.source", source);
        span.setTag("messaging.detailType", detailType);
        span.setTag("messaging.eventBus", eventBusName);

        this.logger.info(String.format("Publishing %s from %s to %s", detailType, source, eventBusName));

        PutEventsRequest request = PutEventsRequest
                .builder()
                .entries(List.of(PutEventsRequestEntry.builder()
                        .eventBusName(eventBusName)
                        .source(source)
                        .detailType(detailType)
                        .detail(detail)
                        .build()))
                .build();

        eventBridge.putEvents(request);
    }
}
