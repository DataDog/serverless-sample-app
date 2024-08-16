/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

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
