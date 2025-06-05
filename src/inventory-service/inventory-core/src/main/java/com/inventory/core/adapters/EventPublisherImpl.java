/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.core.adapters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;
import com.inventory.core.*;
import com.inventory.core.config.AppConfig;
import datadog.trace.api.experimental.DataStreamsCheckpointer;
import datadog.trace.api.experimental.DataStreamsContextCarrier;
import io.opentracing.Scope;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
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
import java.util.Map;
import java.util.Set;

@ApplicationScoped
public class EventPublisherImpl implements EventPublisher {
    private final EventBridgeClient eventBridge;
    private final SnsClient snsClient;
    private final ObjectMapper mapper;
    private final ObjectWriter eventWriter;
    private final AppConfig appConfig;
    private final Logger logger = LoggerFactory.getLogger(EventPublisherImpl.class);

    @Inject
    public EventPublisherImpl(EventBridgeClient eventBridge, SnsClient snsClient, ObjectMapper mapper, AppConfig appConfig) {
        this.eventBridge = eventBridge;
        this.snsClient = snsClient;
        this.mapper = mapper;
        // Pre-configure an ObjectWriter for better serialization performance
        this.eventWriter = mapper.writer();
        this.appConfig = appConfig;
    }

    @Override
    public void publishNewProductAddedEvent(NewProductAddedEvent evt) {
        final Span span = GlobalTracer.get().activeSpan();
        if (span == null) {
            logger.warn("No active span for publishNewProductAddedEvent");
        }

        try {
            var topicArn = appConfig.getProductAddedTopicArn();
            if (topicArn == null || topicArn.isEmpty()) {
                logger.warn("Product added topic ARN is not configured, skipping event publication");
                return;
            }
            
            var evtWrapper = new CloudEventWrapper<>("inventory.productAdded.v1", evt);
            var evtContents = this.eventWriter.writeValueAsString(evtWrapper);

            final Span publishSpan = createPublishSpan(span, "inventory.productAdded", evtWrapper, evtContents.length(), topicArn);

            try (Scope scope = GlobalTracer.get().activateSpan(publishSpan)) {
                var carrier = new Carrier();
                DataStreamsCheckpointer.get().setProduceCheckpoint("sns", evtWrapper.getType(), carrier);

                this.snsClient.publish(PublishRequest.builder()
                        .topicArn(topicArn)
                        .message(evtContents)
                        .build());
                logger.info("Published product added event for productId: {}", evt.getProductId());
            } catch (Exception e) {
                handlePublishError(publishSpan, e);
                return;
            }

            publishSpan.finish();
        } catch (JsonProcessingException e) {
            handleSerializationError(span, e);
        } catch (Exception e) {
            logger.error("Unexpected error publishing product added event", e);
            if (span != null) {
                span.setTag(Tags.ERROR, true);
                span.log(Collections.singletonMap(Fields.ERROR_OBJECT, e));
            }
        }
    }

    @Override
    public void publishInventoryStockUpdatedEvent(InventoryStockUpdatedEvent evt) {
        try {
            var evtWrapper = new CloudEventWrapper<>("inventory.stockUpdated.v1", evt);
            String evtData = this.eventWriter.writeValueAsString(evtWrapper);

            this.publish(evtWrapper.getId(), "inventory.stockUpdated.v1", evtData);
        } catch (JsonProcessingException e) {
            handleSerializationError(GlobalTracer.get().activeSpan(), e);
        }
    }

    @Override
    public void publishStockReservedEvent(StockReservedEventV1 evt) {
        try {
            var evtWrapper = new CloudEventWrapper<>("inventory.stockReserved.v1", evt);
            String evtData = this.eventWriter.writeValueAsString(evtWrapper);

            this.publish(evtWrapper.getId(), "inventory.stockReserved.v1", evtData);
        } catch (JsonProcessingException e) {
            handleSerializationError(GlobalTracer.get().activeSpan(), e);
        }
    }

    @Override
    public void publishProductOutOfStockEvent(ProductOutOfStockEventV1 evt) {
        try {
            var evtWrapper = new CloudEventWrapper<>("inventory.outOfStock.v1", evt);
            String evtData = this.eventWriter.writeValueAsString(evtWrapper);

            this.publish(evtWrapper.getId(),"inventory.outOfStock.v1", evtData);
        } catch (JsonProcessingException e) {
            handleSerializationError(GlobalTracer.get().activeSpan(), e);
        }
    }

    @Override
    public void publishStockReservationFailedEvent(StockReservationFailedEventV1 evt) {
        try {
            var evtWrapper = new CloudEventWrapper<>("inventory.stockReservationFailed.v1", evt);
            String evtData = this.eventWriter.writeValueAsString(evtWrapper);

            this.publish(evtWrapper.getId(), "inventory.stockReservationFailed.v1", evtData);
        } catch (JsonProcessingException e) {
            handleSerializationError(GlobalTracer.get().activeSpan(), e);
        }
    }

    private void publish(String eventId, String detailType, String detail) {
        final Span span = GlobalTracer.get().activeSpan();

        final Span publishSpan = createPublishSpan(span, detailType, null, detail.length(), null);

        try (Scope scope = GlobalTracer.get().activateSpan(publishSpan)) {
            String source = appConfig.getSource();
            String eventBusName = appConfig.getEventBusName();

            if (eventBusName == null || eventBusName.isEmpty()) {
                logger.warn("Event bus name is not configured, skipping event publication");
                publishSpan.finish();
                return;
            }

            logger.info("Publishing {} from {} to {}", detailType, source, eventBusName);

            PutEventsRequest request = PutEventsRequest
                    .builder()
                    .entries(List.of(PutEventsRequestEntry.builder()
                            .eventBusName(eventBusName)
                            .source(source)
                            .detailType(detailType)
                            .detail(detail)
                            .build()))
                    .build();

            try {
                eventBridge.putEvents(request);
            } catch (Exception e) {
                handlePublishError(publishSpan, e);
                return;
            }
        }

        publishSpan.finish();
    }

    private Span createPublishSpan(Span parentSpan, String detailType, CloudEventWrapper<?> evtWrapper, int bodySize, String destination) {
        final Span publishSpan = GlobalTracer.get()
                .buildSpan(String.format("publish %s", detailType))
                .asChildOf(parentSpan)
                .start();

        var carrier = new Carrier();
        DataStreamsCheckpointer.get().setProduceCheckpoint("sns", evtWrapper.getType(), carrier);

        publishSpan.setTag("domain", appConfig.getDomain());
        publishSpan.setTag("messaging.message.eventType", destination == null ? "public" : "private");
        publishSpan.setTag("messaging.message.type", detailType);
        
        if (evtWrapper != null) {
            publishSpan.setTag("messaging.message.id", evtWrapper.getId());
        }
        
        publishSpan.setTag("messaging.operation.type", "publish");
        publishSpan.setTag("messaging.system", destination == null ? "eventbridge" : "aws_sns");
        publishSpan.setTag("messaging.batch.message_count", 1);
        
        if (destination != null) {
            publishSpan.setTag("messaging.destination.name", extractNameFromArn(destination));
        } else {
            publishSpan.setTag("messaging.destination.name", appConfig.getEventBusName());
        }
        
        publishSpan.setTag("messaging.client.id", appConfig.getDdService());
        publishSpan.setTag("messaging.message.body.size", bodySize);
        publishSpan.setTag("messaging.operation.name", "send");

        return publishSpan;
    }

    private void handleSerializationError(Span span, JsonProcessingException exception) {
        logger.error("Error serializing event", exception);
        if (span != null) {
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, exception));
        }
    }
    
    private void handlePublishError(Span span, Exception exception) {
        logger.error("Error publishing event", exception);
        if (span != null) {
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, exception));
        }
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

