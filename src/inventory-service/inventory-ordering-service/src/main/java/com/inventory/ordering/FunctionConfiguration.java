/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.ordering;

import com.amazonaws.services.lambda.runtime.events.SNSEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.ordering.adapters.CloudEventWrapper;

import com.inventory.ordering.core.InventoryOrderingService;
import com.inventory.ordering.core.events.internal.NewProductAddedEvent;
import datadog.trace.api.experimental.DataStreamsCheckpointer;
import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.Scope;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.nio.charset.StandardCharsets;
import java.util.function.Function;

@SpringBootApplication(scanBasePackages = "com.inventory.ordering")
public class FunctionConfiguration {
    @Autowired
    ObjectMapper objectMapper;
    @Autowired
    Logger logger;
    @Autowired
    InventoryOrderingService orderingService;

    public static void main(String[] args) {
        SpringApplication.run(FunctionConfiguration.class, args);
    }

    @Bean
    public Function<SNSEvent, String> handleNewProductAdded() {
        return value -> {
            final Span span = Span.fromContext(Context.current());
            Span processSpan = null;

            try {
                for (SNSEvent.SNSRecord record : value.getRecords()) {
                    TypeReference<CloudEventWrapper<NewProductAddedEvent>> typeRef = new TypeReference<CloudEventWrapper<NewProductAddedEvent>>() {};
                    CloudEventWrapper<NewProductAddedEvent> evtWrapper = objectMapper.readValue(record.getSNS().getMessage(), typeRef);

                    processSpan = GlobalOpenTelemetry
                            .getTracer("com.inventory.ordering.FunctionConfiguration")
                            .spanBuilder(String.format("process %s", "inventory.productAdded"))
                            .setParent(Context.current())
                            .startSpan();

                    try (Scope scope = processSpan.makeCurrent()) {
                        var carrier = new Carrier(evtWrapper.getDatadog());
                        DataStreamsCheckpointer.get().setConsumeCheckpoint("sns", evtWrapper.getType(), carrier);

                        processSpan.setAttribute("product.id", evtWrapper.getData().getProductId());
                        processSpan.setAttribute("messaging.message.id", evtWrapper.getId());
                        processSpan.setAttribute("messaging.operation.type", "process");
                        processSpan.setAttribute("messaging.system", "aws_sns");
                        processSpan.setAttribute("domain", System.getenv("DOMAIN") == null ? "" : System.getenv("DOMAIN"));
                        processSpan.setAttribute("messaging.message.eventType", "private");
                        processSpan.setAttribute("messaging.message.type", evtWrapper.getType());
                        processSpan.setAttribute("messaging.batch.message_count", 1);
                        processSpan.setAttribute("messaging.client.id", System.getenv("DD_SERVICE") == null ? "" : System.getenv("DD_SERVICE"));
                        processSpan.setAttribute("messaging.message.body.size", record.getSNS().getMessage().getBytes(StandardCharsets.UTF_8).length);
                        processSpan.setAttribute("messaging.operation.name", "process");

                        this.orderingService.handleNewProductAdded(evtWrapper.getData());
                    } finally {
                        processSpan.end();
                        processSpan = null;
                    }
                }
            } catch (JsonProcessingException | Error exception) {
                logger.error("An exception occurred!", exception);
                if (span.getSpanContext().isValid()) {
                    span.setStatus(StatusCode.ERROR);
                    span.recordException(exception);
                }
                if (processSpan != null) {
                    processSpan.setStatus(StatusCode.ERROR);
                    processSpan.recordException(exception);
                    processSpan.end();
                }
            }

            return "OK";
        };
    }
}
