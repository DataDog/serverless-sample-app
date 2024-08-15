package com.cdk.inventory.ordering;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.services.sns.ITopic;

public record InventoryOrderingServiceProps(SharedProps sharedProps, ITopic newProductAddedTopic) {
}
