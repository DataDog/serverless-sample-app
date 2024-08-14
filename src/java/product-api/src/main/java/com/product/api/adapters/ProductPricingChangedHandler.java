package com.product.api.adapters;

import com.amazonaws.services.lambda.runtime.events.SNSEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.api.core.ProductService;
import com.product.api.core.events.internal.ProductPriceCalculatedEvent;
import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;

import java.util.Collections;
import java.util.function.Function;

public class ProductPricingChangedHandler {
    @Autowired
    Logger logger;
    
    @Autowired
    ProductService service;
    
    @Autowired
    ObjectMapper mapper;
    
    @Bean
    public Function<SNSEvent, String> handlePricingChanged() {
        return value -> {
            final Span span = GlobalTracer.get().activeSpan();

            try {
                for (SNSEvent.SNSRecord record : value.getRecords()) {
                    ProductPriceCalculatedEvent evt = this.mapper.readValue(record.getSNS().getMessage(), ProductPriceCalculatedEvent.class);
                    
                    this.service.handleProductPriceCalculatedEvent(evt);
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
