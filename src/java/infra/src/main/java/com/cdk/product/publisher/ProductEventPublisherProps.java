package com.cdk.product.publisher;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.services.events.IEventBus;
import software.amazon.awscdk.services.sns.ITopic;

public record ProductEventPublisherProps(SharedProps sharedProps, ITopic productCreatedTopic,
                                         ITopic productUpdatedTopic, ITopic productDeletedTopic,
                                         IEventBus sharedEventBus) {
}
