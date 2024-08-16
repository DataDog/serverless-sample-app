/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.pricing;

import com.amazonaws.services.lambda.runtime.events.SNSEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.pricing.core.PricingService;
import com.product.pricing.core.events.internal.ProductCreatedEvent;
import com.product.pricing.core.events.internal.ProductUpdatedEvent;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.util.Collections;
import java.util.function.Function;

@SpringBootApplication(scanBasePackages = "com.product.pricing")
public class FunctionConfiguration {
    @Autowired
    ObjectMapper objectMapper;
    @Autowired
    Logger logger;

    @Autowired
    PricingService pricingService;

    public static void main(String[] args) {
        SpringApplication.run(FunctionConfiguration.class, args);
    }

    @Bean
    public Function<SNSEvent, String> handleProductCreated() {
        return value -> {
            final Span span = GlobalTracer.get().activeSpan();

            try {
                for (SNSEvent.SNSRecord record : value.getRecords()) {
                    ProductCreatedEvent evt = this.objectMapper.readValue(record.getSNS().getMessage(), ProductCreatedEvent.class);

                    this.pricingService.calculatePricing(evt.getProductId(), evt.getPrice());
                }
            } catch (JsonProcessingException | Error exception) {
                logger.error("An exception occurred!", exception);
                span.setTag(Tags.ERROR, true);
                span.log(Collections.singletonMap(Fields.ERROR_OBJECT, exception));
            }

            return "OK";
        };
    }

    @Bean
    public Function<SNSEvent, String> handleProductUpdated() {
        return value -> {
            final Span span = GlobalTracer.get().activeSpan();

            try {
                for (SNSEvent.SNSRecord record : value.getRecords()) {
                    ProductUpdatedEvent evt = this.objectMapper.readValue(record.getSNS().getMessage(), ProductUpdatedEvent.class);

                    this.pricingService.calculatePricing(evt.getProductId(), evt.getUpdated().getPrice());
                }
            } catch (JsonProcessingException | Error exception) {
                logger.error("An exception occurred!", exception);
                span.setTag(Tags.ERROR, true);
                span.log(Collections.singletonMap(Fields.ERROR_OBJECT, exception));
            }

            return "OK";
        };
    }
}
