/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk;

import com.cdk.analytics.AnalyticsBackendStack;
import com.cdk.inventory.acl.InventoryAclStack;
import com.cdk.inventory.ordering.InventoryOrderingServiceStack;
import com.cdk.product.api.ProductApiStack;
import com.cdk.product.apiworker.ProductApiWorkerStack;
import com.cdk.product.pricing.PricingServiceStack;
import com.cdk.product.publisher.ProductEventPublisherStack;
import com.cdk.shared.SharedStack;
import software.amazon.awscdk.App;
import software.amazon.awscdk.StackProps;

public class JavaTraceSampleApp {
    public static void main(final String[] args) {
        App app = new App();
        
        var sharedStack = new SharedStack(app, "JavaSharedStack", StackProps.builder().build());

        var productApiStack = new ProductApiStack(app, "JavaProductApiStack", StackProps.builder()
                .build());
        
        var pricingService = new PricingServiceStack(app, "JavaProductPricingService", StackProps.builder().build());
        pricingService.addDependency(productApiStack);
        
        var productApiWorkerService = new ProductApiWorkerStack(app, "JavaProductApiWorkerService", StackProps.builder().build());
        productApiWorkerService.addDependency(pricingService);
        
        var eventPublisherService = new ProductEventPublisherStack(app, "JavaEventPublisherStack", StackProps.builder().build());
        eventPublisherService.addDependency(sharedStack);
        eventPublisherService.addDependency(productApiStack);
        
        var inventoryAclService = new InventoryAclStack(app, "JavaInventoryAcl", StackProps.builder().build());
        inventoryAclService.addDependency(sharedStack);
        
        var inventoryOrderingService = new InventoryOrderingServiceStack(app, "JavaInventoryOrdering", StackProps.builder().build());
        inventoryOrderingService.addDependency(inventoryAclService);
        
        var analyticsBackend = new AnalyticsBackendStack(app, "JavaAnalyticsBackend", StackProps.builder().build());
        analyticsBackend.addDependency(sharedStack);
        
        app.synth();
    }
}

