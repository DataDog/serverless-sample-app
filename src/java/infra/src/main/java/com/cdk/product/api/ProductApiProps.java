package com.cdk.product.api;

import com.cdk.constructs.SharedProps;

public class ProductApiProps {
    private final SharedProps sharedProps;

    public ProductApiProps(SharedProps sharedProps) {
        this.sharedProps = sharedProps;
    }

    public SharedProps getSharedProps() {
        return sharedProps;
    }
}
