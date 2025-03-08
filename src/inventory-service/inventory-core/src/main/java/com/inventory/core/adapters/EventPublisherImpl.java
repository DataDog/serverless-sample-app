/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core.adapters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.core.*;
import io.opentracing.Scope;
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
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.PublishRequest;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

@ApplicationScoped
public class EventPublisherImpl implements EventPublisher {
    private final EventBridgeClient eventBridge;
    private final SnsClient snsClient;
    private final ObjectMapper mapper;
    private final Logger logger = LoggerFactory.getLogger(EventPublisherImpl.class);

    public EventPublisherImpl(EventBridgeClient sns, SnsClient snsClient, ObjectMapper mapper) {
        this.eventBridge = sns;
        this.snsClient = snsClient;
        this.mapper = mapper;
    }

    @Override
    public void publishNewProductAddedEvent(NewProductAddedEvent evt) {
        final Span span = GlobalTracer.get().activeSpan();

        try {
            var topicArn = System.getenv("PRODUCT_ADDED_TOPIC_ARN");
            var evtWrapper = new CloudEventWrapper<NewProductAddedEvent>("inventory.productAdded.v1", evt);
            var evtContents = this.mapper.writeValueAsString(evtWrapper);

            final Span publishSpan = GlobalTracer.get()
                    .buildSpan(String.format("publish %s", "inventory.productAdded"))
                    .asChildOf(span)
                    .start();

            publishSpan.setTag("domain", System.getenv("DOMAIN") == null ? "" : System.getenv("DOMAIN"));
            publishSpan.setTag("messaging.message.eventType", "private");
            publishSpan.setTag("messaging.message.type", evtWrapper.getType());
            publishSpan.setTag("messaging.message.id", evtWrapper.getId());
            publishSpan.setTag("messaging.operation.type", "publish");
            publishSpan.setTag("messaging.system", "aws_sns");
            publishSpan.setTag("messaging.batch.message_count", 1);
            publishSpan.setTag("messaging.destination.name", extractNameFromArn(topicArn));
            publishSpan.setTag("messaging.client.id", System.getenv("DD_SERVICE") == null ? "" : System.getenv("DD_SERVICE"));
            publishSpan.setTag("messaging.message.body.size", evtContents.getBytes(StandardCharsets.UTF_8).length);
            publishSpan.setTag("messaging.operation.name", "send");

            try (Scope scope = GlobalTracer.get().activateSpan(publishSpan)) {
                this.snsClient.publish(PublishRequest.builder()
                        .topicArn(topicArn)
                        .message(evtContents)
                        .build());
            }

            publishSpan.finish();

        } catch (JsonProcessingException exception) {
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, exception));
        }
    }

    @Override
    public void publishInventoryStockUpdatedEvent(InventoryStockUpdatedEvent evt) {
        final Span span = GlobalTracer.get().activeSpan();

        try {
            var evtWrapper = new CloudEventWrapper<InventoryStockUpdatedEvent>("inventory.stockUpdated.v1", evt);
            String evtData = mapper.writeValueAsString(evtWrapper.getId());

            this.publish(evtWrapper.getId(), "inventory.stockUpdated.v1", evtData);
        }
        catch (JsonProcessingException error){
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));
        }
    }

    @Override
    public void publishStockReservedEvent(StockReservedEventV1 evt) {
        final Span span = GlobalTracer.get().activeSpan();

        try {
            var evtWrapper = new CloudEventWrapper<StockReservedEventV1>("inventory.stockReserved.v1", evt);
            String evtData = mapper.writeValueAsString(evtWrapper);

            this.publish(evtWrapper.getId(), "inventory.stockReserved.v1", evtData);
        }
        catch (JsonProcessingException error){
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));
        }
    }

    @Override
    public void publishProductOutOfStockEvent(ProductOutOfStockEventV1 evt) {
        final Span span = GlobalTracer.get().activeSpan();

        try {
            var evtWrapper =new CloudEventWrapper<ProductOutOfStockEventV1>("inventory.outOfStock.v1", evt);
            String evtData = mapper.writeValueAsString(evtWrapper);

            this.publish(evtWrapper.getId(),"inventory.outOfStock.v1", evtData);
        }
        catch (JsonProcessingException error){
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));
        }
    }

    @Override
    public void publishStockReservationFailedEvent(StockReservationFailedEventV1 evt) {
        final Span span = GlobalTracer.get().activeSpan();

        try {
            var evtWrapper = new CloudEventWrapper<StockReservationFailedEventV1>("inventory.stockReservationFailed.v1", evt);
            String evtData = mapper.writeValueAsString(evtWrapper);

            this.publish(evtWrapper.getId(), "inventory.stockReservationFailed.v1", evtData);
        }
        catch (JsonProcessingException error){
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));
        }
    }

    private void publish(String eventId, String detailType, String detail){
        final Span span = GlobalTracer.get().activeSpan();

        final Span publishSpan = GlobalTracer.get()
                .buildSpan(String.format("publish %s", detailType))
                .asChildOf(span)
                .start();

        try (Scope scope = GlobalTracer.get().activateSpan(publishSpan)) {
            String source = String.format("%s.inventory", System.getenv("ENV"));
            String eventBusName = System.getenv("EVENT_BUS_NAME");

            publishSpan.setTag("domain", System.getenv("DOMAIN") == null ? "" : System.getenv("DOMAIN"));
            publishSpan.setTag("messaging.message.eventType", "public");
            publishSpan.setTag("messaging.message.type", detailType);
            publishSpan.setTag("messaging.message.domain", System.getenv("DOMAIN"));
            publishSpan.setTag("messaging.message.id", eventId);
            publishSpan.setTag("messaging.operation.type", "publish");
            publishSpan.setTag("messaging.system", "eventbridge");
            publishSpan.setTag("messaging.batch.message_count", 1);
            publishSpan.setTag("messaging.destination.name", eventBusName);
            publishSpan.setTag("messaging.client.id", System.getenv("DD_SERVICE") == null ? "" : System.getenv("DD_SERVICE"));
            publishSpan.setTag("messaging.message.body.size", detail.getBytes(StandardCharsets.UTF_8).length);
            publishSpan.setTag("messaging.operation.name", "send");

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

        publishSpan.finish();
    }

    private String extractNameFromArn(String arn) {
        if (arn == null || arn.isEmpty()) {
            return arn;
        }
        String[] arnParts = arn.split(":");
        if (arnParts.length < 6) {
            return arn;
        }
        return arnParts[arnParts.length - 1];
    }
}
