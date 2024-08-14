package com.cdk.product.pricing;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.services.sns.ITopic;

public class PricingServiceProps {
    private final SharedProps sharedProps;
    private final ITopic productCreatedTopic;
    private final ITopic productUpdatedTopic;

    public PricingServiceProps(SharedProps sharedProps, ITopic productCreatedTopic, ITopic productUpdatedTopic) {
        this.sharedProps = sharedProps;
        this.productCreatedTopic = productCreatedTopic;
        this.productUpdatedTopic = productUpdatedTopic;
    }

    public SharedProps getSharedProps() {
        return sharedProps;
    }

    public ITopic getProductCreatedTopic() {
        return productCreatedTopic;
    }

    public ITopic getProductUpdatedTopic() {
        return productUpdatedTopic;
    }
}
