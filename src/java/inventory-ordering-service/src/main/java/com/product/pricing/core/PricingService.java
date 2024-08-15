package com.product.pricing.core;

import org.springframework.stereotype.Service;

import java.util.HashMap;

@Service
public class PricingService {
    private final EventPublisher eventPublisher;

    public PricingService(EventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }
    
    public void calculatePricing(String productId, Double currentPrice) {
        HashMap<Double, Double> pricingBreakdown = new HashMap<>();
        pricingBreakdown.put(5.0, currentPrice * 0.95);
        pricingBreakdown.put(10.0, currentPrice * 0.9);
        pricingBreakdown.put(25.0, currentPrice * 0.8);
        pricingBreakdown.put(50.0, currentPrice * 0.75);
        pricingBreakdown.put(100.0, currentPrice * 0.7);
        
        this.eventPublisher.publishPriceCalculatedEvent(new ProductPriceCalculatedEvent(productId, pricingBreakdown));
    }
}
