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
import io.opentracing.Scope;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
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
            final Span span = GlobalTracer.get().activeSpan();

            try {
                for (SNSEvent.SNSRecord record : value.getRecords()) {
                    TypeReference<CloudEventWrapper<NewProductAddedEvent>> typeRef = new TypeReference<CloudEventWrapper<NewProductAddedEvent>>() {};
                    CloudEventWrapper<NewProductAddedEvent> evtWrapper = objectMapper.readValue(record.getSNS().getMessage(), typeRef);

                    final Span processSpan = GlobalTracer
                            .get()
                            .buildSpan(String.format("process %s", "inventory.productAdded"))
                            .asChildOf(span)
                            .start();

                    try (Scope scope = GlobalTracer.get().activateSpan(processSpan)) {
                        processSpan.setTag("product.id", evtWrapper.getData().getProductId());
                        processSpan.setTag("messaging.message.id", evtWrapper.getId());
                        processSpan.setTag("messaging.operation.type", "process");
                        processSpan.setTag("messaging.system", "aws_sqs");
                        processSpan.setTag("domain", System.getenv("DOMAIN") == null ? "" : System.getenv("DOMAIN"));
                        processSpan.setTag("messaging.message.eventType", "private");
                        processSpan.setTag("messaging.message.type", evtWrapper.getType());
                        processSpan.setTag("messaging.message.id", evtWrapper.getId());
                        processSpan.setTag("messaging.system", "aws_sns");
                        processSpan.setTag("messaging.batch.message_count", 1);
                        processSpan.setTag("messaging.client.id", System.getenv("DD_SERVICE") == null ? "" : System.getenv("DD_SERVICE"));
                        processSpan.setTag("messaging.message.body.size", record.getSNS().getMessage().getBytes(StandardCharsets.UTF_8).length);
                        processSpan.setTag("messaging.operation.name", "process");

                        this.orderingService.handleNewProductAdded(evtWrapper.getData());
                    }

                    processSpan.finish();
                }
            } catch (JsonProcessingException | Error exception) {
                logger.error("An exception occurred!", exception);
                span.setTag(Tags.ERROR, true);
                span.log(Collections.singletonMap(Fields.ERROR_OBJECT, exception));

                span.finish();
            }

            return "OK";
        };
    }
}
