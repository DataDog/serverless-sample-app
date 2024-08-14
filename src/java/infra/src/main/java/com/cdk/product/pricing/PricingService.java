package com.cdk.product.pricing;

import com.cdk.constructs.InstrumentedFunction;
import com.cdk.constructs.InstrumentedFunctionProps;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.aws_apigatewayv2_integrations.HttpLambdaIntegration;
import software.amazon.awscdk.services.apigatewayv2.AddRoutesOptions;
import software.amazon.awscdk.services.apigatewayv2.HttpApi;
import software.amazon.awscdk.services.apigatewayv2.HttpMethod;
import software.amazon.awscdk.services.apigatewayv2.IHttpApi;
import software.amazon.awscdk.services.dynamodb.*;
import software.amazon.awscdk.services.lambda.IFunction;
import software.amazon.awscdk.services.lambda.eventsources.SnsEventSource;
import software.amazon.awscdk.services.ses.actions.Sns;
import software.amazon.awscdk.services.sns.ITopic;
import software.amazon.awscdk.services.sns.Topic;
import software.amazon.awscdk.services.sns.TopicProps;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.amazon.awscdk.services.ssm.StringParameterProps;
import software.constructs.Construct;

import java.util.HashMap;
import java.util.List;

public class PricingService extends Construct {
    public PricingService(@NotNull Construct scope, @NotNull String id, @NotNull PricingServiceProps props) {
        super(scope, id);
        
        ITopic priceCalculatedTopic = new Topic(this, "JavaPriceCalculatedTopic", TopicProps.builder()
                .topicName(String.format("ProductPriceCalculated-%s", props.getSharedProps().getEnv()))
                .build());

        HashMap<String, String> functionEnvVars = new HashMap<>(2);
        functionEnvVars.put("PRODUCT_CREATED_TOPIC_ARN", props.getProductCreatedTopic().getTopicArn());
        functionEnvVars.put("PRODUCT_UPDATED_TOPIC_ARN", props.getProductUpdatedTopic().getTopicArn());
        functionEnvVars.put("PRICE_CALCULATED_TOPIC_ARN", priceCalculatedTopic.getTopicArn());
        
        String compiledJarFilePath = "../product-pricing/target/com.product.pricing-0.0.1-SNAPSHOT-aws.jar";

        IFunction getProductFunction = new InstrumentedFunction(this, "PriceCalculatedJavaFunction",
                new InstrumentedFunctionProps(props.getSharedProps(), "com.product.pricing", compiledJarFilePath, "handlePricingChanged", functionEnvVars)).getFunction();
        priceCalculatedTopic.grantPublish(getProductFunction);
        
        getProductFunction.addEventSource(new SnsEventSource(props.getProductCreatedTopic()));
        getProductFunction.addEventSource(new SnsEventSource(props.getProductUpdatedTopic()));
        
        StringParameter priceCalculatedTopicArnParam = new StringParameter(this, "PriceCalculatedTopicArn", StringParameterProps.builder()
                .parameterName("/java/product-pricing/product-calculated-topic")
                .stringValue(priceCalculatedTopic.getTopicArn())
                .build());
        StringParameter priceCalculatedTopicNameParam = new StringParameter(this, "PriceCalculatedTopicName", StringParameterProps.builder()
                .parameterName("/java/product-pricing/product-calculated-topic-name")
                .stringValue(priceCalculatedTopic.getTopicName())
                .build());
        
    }
}
