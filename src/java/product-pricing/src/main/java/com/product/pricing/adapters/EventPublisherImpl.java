package com.product.pricing.adapters;

import com.amazonaws.services.sns.AmazonSNS;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.pricing.core.EventPublisher;
import com.product.pricing.core.ProductPriceCalculatedEvent;
import org.springframework.stereotype.Component;

@Component
public class EventPublisherImpl implements EventPublisher {
    private final AmazonSNS sns;
    private final ObjectMapper mapper;

    public EventPublisherImpl(AmazonSNS sns, ObjectMapper mapper) {
        this.sns = sns;
        this.mapper = mapper;
    }

    @Override
    public void publishPriceCalculatedEvent(ProductPriceCalculatedEvent evt) {
        try {
            sns.publish(System.getenv("PRICE_CALCULATED_TOPIC_ARN"), this.mapper.writeValueAsString(evt));
            
            return;
        }
        catch (JsonProcessingException exception) {
            return;
        }
    }
}
