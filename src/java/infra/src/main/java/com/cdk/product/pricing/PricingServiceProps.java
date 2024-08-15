package com.cdk.product.pricing;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.services.sns.ITopic;

public record PricingServiceProps(SharedProps sharedProps, ITopic productCreatedTopic, ITopic productUpdatedTopic) {
}
