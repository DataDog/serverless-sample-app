package com.product.publisher.core;

import com.product.publisher.core.events.external.ProductCreatedEventV1;
import com.product.publisher.core.events.external.ProductDeletedEventV1;
import com.product.publisher.core.events.external.ProductUpdatedEventV1;
import com.product.publisher.core.events.internal.ProductCreatedEvent;
import com.product.publisher.core.events.internal.ProductDeletedEvent;
import com.product.publisher.core.events.internal.ProductUpdatedEvent;
import io.opentracing.Span;
import io.opentracing.util.GlobalTracer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class InternalEventHandler {
    @Autowired
    EventPublisher publisher;
    
    Logger logger = LoggerFactory.getLogger(InternalEventHandler.class);
    
    public void handleProductCreatedEvent(ProductCreatedEvent evt) {
        Span activeSpan = GlobalTracer.get().activeSpan();
        
        logger.info(String.format("Handling product created event for product `%s`", evt.getProductId()));
        this.publisher.publishProductCreatedEvent(new ProductCreatedEventV1(activeSpan, evt.getProductId()));
    }

    public void handleProductUpdatedEvent(ProductUpdatedEvent evt){
        Span activeSpan = GlobalTracer.get().activeSpan();
        logger.info(String.format("Handling product updated event for product `%s`", evt.getProductId()));
        this.publisher.publishProductUpdatedEvent(new ProductUpdatedEventV1(activeSpan, evt.getProductId()));
    }

    public void handleProductDeletedEvent(ProductDeletedEvent evt){
        Span activeSpan = GlobalTracer.get().activeSpan();
        logger.info(String.format("Handling product deleted event for product `%s`", evt.getProductId()));
        this.publisher.publishProductDeletedEvent(new ProductDeletedEventV1(activeSpan, evt.getProductId()));
    }
}
