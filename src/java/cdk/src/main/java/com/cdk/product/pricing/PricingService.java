package com.cdk.product.pricing;

import com.cdk.constructs.InstrumentedFunction;
import com.cdk.constructs.InstrumentedFunctionProps;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.services.lambda.IFunction;
import software.amazon.awscdk.services.lambda.eventsources.SnsEventSource;
import software.amazon.awscdk.services.lambda.eventsources.SnsEventSourceProps;
import software.amazon.awscdk.services.sns.ITopic;
import software.amazon.awscdk.services.sns.Topic;
import software.amazon.awscdk.services.sns.TopicProps;
import software.amazon.awscdk.services.sqs.Queue;
import software.amazon.awscdk.services.sqs.QueueProps;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.amazon.awscdk.services.ssm.StringParameterProps;
import software.constructs.Construct;

import java.util.HashMap;

public class PricingService extends Construct {
    public PricingService(@NotNull Construct scope, @NotNull String id, @NotNull PricingServiceProps props) {
        super(scope, id);
        
        ITopic priceCalculatedTopic = new Topic(this, "JavaPriceCalculatedTopic", TopicProps.builder()
                .topicName(String.format("ProductPriceCalculated-%s", props.sharedProps().env()))
                .build());

        HashMap<String, String> functionEnvVars = new HashMap<>(2);
        functionEnvVars.put("PRODUCT_CREATED_TOPIC_ARN", props.productCreatedTopic().getTopicArn());
        functionEnvVars.put("PRODUCT_UPDATED_TOPIC_ARN", props.productUpdatedTopic().getTopicArn());
        functionEnvVars.put("PRICE_CALCULATED_TOPIC_ARN", priceCalculatedTopic.getTopicArn());
        
        String compiledJarFilePath = "../product-pricing/target/com.product.pricing-0.0.1-SNAPSHOT-aws.jar";

        IFunction getProductFunction = new InstrumentedFunction(this, "PriceCalculatedJavaFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.product.pricing", compiledJarFilePath, "handlePricingChanged", functionEnvVars)).getFunction();
        priceCalculatedTopic.grantPublish(getProductFunction);
        
        getProductFunction.addEventSource(new SnsEventSource(props.productCreatedTopic(), SnsEventSourceProps.builder()
                .deadLetterQueue(new Queue(this, "ProductCreatedEventSourceDLQ", QueueProps.builder()
                        .queueName(String.format("ProductCreatedEventSourceDLQ-%s", props.sharedProps().env()))
                        .build()))
                .build()));
        getProductFunction.addEventSource(new SnsEventSource(props.productUpdatedTopic(), SnsEventSourceProps.builder()
                .deadLetterQueue(new Queue(this, "ProductUpdatedEventSourceDLQ", QueueProps.builder()
                        .queueName(String.format("ProductUpdatedEventSourceDLQ-%s", props.sharedProps().env()))
                        .build()))
                .build()));
        
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
