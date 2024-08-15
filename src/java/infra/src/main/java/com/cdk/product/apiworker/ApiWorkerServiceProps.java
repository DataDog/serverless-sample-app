package com.cdk.product.apiworker;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.services.dynamodb.ITable;
import software.amazon.awscdk.services.sns.ITopic;

public record ApiWorkerServiceProps(SharedProps sharedProps, ITopic priceCalculatedTopic, ITable productApiTable) {
}
