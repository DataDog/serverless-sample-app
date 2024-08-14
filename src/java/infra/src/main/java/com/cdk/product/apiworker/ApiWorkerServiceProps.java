package com.cdk.product.apiworker;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.services.dynamodb.ITable;
import software.amazon.awscdk.services.sns.ITopic;

public class ApiWorkerServiceProps {
    private final SharedProps sharedProps;
    private final ITopic priceCalculatedTopic;
    private final ITable productApiTable;

    public ApiWorkerServiceProps(SharedProps sharedProps, ITopic priceCalculatedTopic, ITable productApiTable) {
        this.sharedProps = sharedProps;
        this.priceCalculatedTopic = priceCalculatedTopic;
        this.productApiTable = productApiTable;
    }

    public SharedProps getSharedProps() {
        return sharedProps;
    }

    public ITopic getpriceCalculatedTopic() {
        return priceCalculatedTopic;
    }

    public ITable getProductApiTable() {
        return productApiTable;
    }
}
