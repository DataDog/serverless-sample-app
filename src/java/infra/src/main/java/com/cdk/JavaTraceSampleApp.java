package com.cdk;

import com.cdk.product.api.ProductApiStack;
import com.cdk.product.apiworker.ProductApiWorkerStack;
import com.cdk.product.pricing.PricingServiceStack;
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
        
        app.synth();
    }
}

