/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk;

import com.cdk.analytics.AnalyticsBackendStack;
import com.cdk.inventory.acl.InventoryAclStack;
import com.cdk.inventory.api.InventoryApiContainer;
import com.cdk.inventory.api.InventoryApiContainerStack;
import com.cdk.inventory.ordering.InventoryOrderingServiceStack;
import com.cdk.product.api.ProductApiStack;
import com.cdk.product.api.container.ProductApiContainerStack;
import com.cdk.product.apiworker.ProductApiWorkerStack;
import com.cdk.product.pricing.PricingServiceStack;
import com.cdk.product.publisher.ProductEventPublisherStack;
import com.cdk.shared.SharedStack;
import software.amazon.awscdk.App;
import software.amazon.awscdk.StackProps;

public class JavaTraceSampleApp {
    public static void main(final String[] args) {
        App app = new App();

        String env = System.getenv("ENV") == null ? "dev" : System.getenv("ENV");
        var sharedStack = new SharedStack(app, "JavaSharedStack", StackProps.builder()
                .stackName(String.format("JavaSharedStack-%s", env))
                .build());

        var productApiContainerStack = new ProductApiContainerStack(app, "JavaProductApiContainerStack", StackProps.builder()
                .stackName(String.format("JavaProductApiContainerStack-%s", env))
                .build());
        
        var pricingService = new PricingServiceStack(app, "JavaProductPricingService", StackProps.builder()
                .stackName(String.format("JavaProductPricingService-%s", env))
                .build());
        pricingService.addDependency(productApiContainerStack);
        
        var productApiWorkerService = new ProductApiWorkerStack(app, "JavaProductApiWorkerService", StackProps.builder()
                .stackName(String.format("JavaProductApiWorkerService-%s", env))
                .build());
        productApiWorkerService.addDependency(pricingService);
        
        var eventPublisherService = new ProductEventPublisherStack(app, "JavaEventPublisherStack", StackProps.builder()
                .stackName(String.format("JavaEventPublisherStack-%s", env))
                .build());
        eventPublisherService.addDependency(sharedStack);
        eventPublisherService.addDependency(productApiContainerStack);

        var inventoryApiService = new InventoryApiContainerStack(app, "JavaInventoryApi", StackProps.builder()
                .stackName(String.format("JavaInventoryApi-%s", env))
                .build());
        inventoryApiService.addDependency(sharedStack);
        
        var inventoryAclService = new InventoryAclStack(app, "JavaInventoryAcl", StackProps.builder()
                .stackName(String.format("JavaInventoryAcl-%s", env))
                .build());
        inventoryAclService.addDependency(sharedStack);
        
        var inventoryOrderingService = new InventoryOrderingServiceStack(app, "JavaInventoryOrdering", StackProps.builder()
                .stackName(String.format("JavaInventoryOrdering-%s", env))
                .build());
        inventoryOrderingService.addDependency(inventoryAclService);
        inventoryOrderingService.addDependency(inventoryApiService);
        
        var analyticsBackend = new AnalyticsBackendStack(app, "JavaAnalyticsBackend", StackProps.builder()
                .stackName(String.format("JavaAnalyticsBackend-%s", env))
                .build());
        analyticsBackend.addDependency(sharedStack);
        
        app.synth();
    }
}

