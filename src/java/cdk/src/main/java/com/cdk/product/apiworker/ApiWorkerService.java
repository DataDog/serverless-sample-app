/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.product.apiworker;

import com.cdk.constructs.InstrumentedFunction;
import com.cdk.constructs.InstrumentedFunctionProps;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.services.lambda.IFunction;
import software.amazon.awscdk.services.lambda.eventsources.SnsEventSource;
import software.constructs.Construct;

import java.util.HashMap;

public class ApiWorkerService extends Construct {
    public ApiWorkerService(@NotNull Construct scope, @NotNull String id, @NotNull ApiWorkerServiceProps props) {
        super(scope, id);
        HashMap<String, String> functionEnvVars = new HashMap<>(2);
        functionEnvVars.put("TABLE_NAME", props.productApiTable().getTableName());
        
        String compiledJarFilePath = "../product-api/target/com.product.api-0.0.1-SNAPSHOT-aws.jar";

        IFunction handlePriceCalculatedFunction = new InstrumentedFunction(this, "HandlePriceCalculatedFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.product.api", compiledJarFilePath, "handlePricingChanged", functionEnvVars)).getFunction();
        handlePriceCalculatedFunction.addEventSource(new SnsEventSource(props.priceCalculatedTopic()));
        props.productApiTable().grantReadWriteData(handlePriceCalculatedFunction);

        IFunction handleStockUpdatedFunction = new InstrumentedFunction(this, "HandleProductStockUpdatedFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.product.api", compiledJarFilePath, "handleProductStockUpdated", functionEnvVars)).getFunction();
        handlePriceCalculatedFunction.addEventSource(new SnsEventSource(props.stockUpdatedTopic()));
        props.productApiTable().grantReadWriteData(handlePriceCalculatedFunction);
        
    }
}
