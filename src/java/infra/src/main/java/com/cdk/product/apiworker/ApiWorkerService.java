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
        
    }
}
