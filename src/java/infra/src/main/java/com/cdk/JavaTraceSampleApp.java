package com.cdk;

import com.cdk.product.api.ProductApiStack;
import com.cdk.shared.SharedStack;
import software.amazon.awscdk.App;
import software.amazon.awscdk.StackProps;

public class JavaTraceSampleApp {
    public static void main(final String[] args) {
        App app = new App();
        
        var sharedStack = new SharedStack(app, "JavaSharedStack", StackProps.builder().build());

        var productApiStack = new ProductApiStack(app, "JavaProductApiStack", StackProps.builder()
                .build());

        app.synth();
    }
}

