/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.acl;

import com.amazonaws.services.lambda.runtime.events.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.product.acl.adapters.EventBridgeMessageWrapper;
import com.product.acl.core.ExternalEventHandler;
import com.product.acl.core.events.external.InventoryStockUpdatedEventV1;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Function;

@SpringBootApplication(scanBasePackages = "com.product.acl")
public class FunctionConfiguration {
    @Autowired
    ObjectMapper objectMapper;
    Logger logger = LoggerFactory.getLogger(FunctionConfiguration.class);
    @Autowired
    ExternalEventHandler eventHandler;

    public static void main(String[] args) {
        SpringApplication.run(FunctionConfiguration.class, args);
    }

    @Bean
    public Function<SQSEvent, SQSBatchResponse> handleStockUpdatedEvent() {
        return value -> {
            final Span span = GlobalTracer.get().activeSpan();
            span.setTag("messaging.batch.message_count", value.getRecords().size());
            span.setTag("messaging.operation.type", "receive");
            span.setTag("messaging.system", "aws_sqs");

            List<SQSBatchResponse.BatchItemFailure> batchItemFailures = new ArrayList<>();
            
            for (SQSEvent.SQSMessage message : value.getRecords()) {
                final Span processSpan = GlobalTracer.get().buildSpan("process").asChildOf(span).start();

                processSpan.setTag("messaging.id", message.getMessageId());
                processSpan.setTag("messaging.operation.type", "process");
                processSpan.setTag("messaging.system", "aws_sqs");
                        
                try {
                    TypeReference<EventBridgeMessageWrapper<InventoryStockUpdatedEventV1>> typeRef = new TypeReference<EventBridgeMessageWrapper<InventoryStockUpdatedEventV1>>(){};

                    EventBridgeMessageWrapper<InventoryStockUpdatedEventV1> evtWrapper = objectMapper.readValue(message.getBody(), typeRef);
                    
                    this.logger.info(evtWrapper.getDetail().getProductId());
                    
                    this.eventHandler.handleInventoryStockUpdatedEvent(evtWrapper.getDetail());
                } catch (JsonProcessingException | Error exception) {
                    batchItemFailures.add(SQSBatchResponse.BatchItemFailure.builder().withItemIdentifier(message.getMessageId()).build());
                    logger.error("An exception occurred!", exception);
                    span.setTag(Tags.ERROR, true);
                    span.log(Collections.singletonMap(Fields.ERROR_OBJECT, exception));
                }
                finally {
                    processSpan.finish();
                }
            }

            return SQSBatchResponse.builder()
                    .withBatchItemFailures(batchItemFailures)
                    .build();
        };
    }
}
