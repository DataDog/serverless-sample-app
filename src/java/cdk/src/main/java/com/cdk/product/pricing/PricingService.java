/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.product.pricing;

import com.cdk.constructs.InstrumentedFunction;
import com.cdk.constructs.InstrumentedFunctionProps;
import com.cdk.constructs.SharedProps;
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
        
        String compiledJarFilePath = "../product-pricing/target/com.product.pricing-0.0.1-SNAPSHOT-aws.jar";

        createHandleProductCreatedFunction(props, priceCalculatedTopic, compiledJarFilePath);
        createHandleProductUpdatedFunction(props, priceCalculatedTopic, compiledJarFilePath);
        
        StringParameter priceCalculatedTopicArnParam = new StringParameter(this, "PriceCalculatedTopicArn", StringParameterProps.builder()
                .parameterName("/java/product-pricing/product-calculated-topic")
                .stringValue(priceCalculatedTopic.getTopicArn())
                .build());
        StringParameter priceCalculatedTopicNameParam = new StringParameter(this, "PriceCalculatedTopicName", StringParameterProps.builder()
                .parameterName("/java/product-pricing/product-calculated-topic-name")
                .stringValue(priceCalculatedTopic.getTopicName())
                .build());
        
    }
    
    private IFunction createHandleProductCreatedFunction(PricingServiceProps props, ITopic priceCalculatedTopic, String compiledJarFilePath){

        HashMap<String, String> functionEnvVars = new HashMap<>(2);
        functionEnvVars.put("PRICE_CALCULATED_TOPIC_ARN", priceCalculatedTopic.getTopicArn());
        functionEnvVars.put("DD_SERVICE_MAPPING", String.format("lambda_sns:%s", props.productCreatedTopic().getTopicName()));
        
        IFunction handleProductCreatedEventFunction = new InstrumentedFunction(this, "HandleProductCreatedEventFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.product.pricing", compiledJarFilePath, "handleProductCreated", functionEnvVars)).getFunction();
        priceCalculatedTopic.grantPublish(handleProductCreatedEventFunction);

        handleProductCreatedEventFunction.addEventSource(new SnsEventSource(props.productCreatedTopic(), SnsEventSourceProps.builder()
                .deadLetterQueue(new Queue(this, "ProductCreatedEventSourceDLQ", QueueProps.builder()
                        .queueName(String.format("ProductCreatedEventSourceDLQ-%s", props.sharedProps().env()))
                        .build()))
                .build()));
        
        return handleProductCreatedEventFunction;
    }
    
    private IFunction createHandleProductUpdatedFunction(PricingServiceProps props, ITopic priceCalculatedTopic, String compiledJarFilePath){
        HashMap<String, String> functionEnvVars = new HashMap<>(2);
        functionEnvVars.put("PRICE_CALCULATED_TOPIC_ARN", priceCalculatedTopic.getTopicArn());
        functionEnvVars.put("DD_SERVICE_MAPPING", String.format("lambda_sns:%s", props.productUpdatedTopic().getTopicName()));
        
        IFunction handleProductUpdatedEventFunction = new InstrumentedFunction(this, "HandleProductUpdatedEventFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.product.pricing", compiledJarFilePath, "handleProductUpdated", functionEnvVars)).getFunction();
        priceCalculatedTopic.grantPublish(handleProductUpdatedEventFunction);
        handleProductUpdatedEventFunction.addEventSource(new SnsEventSource(props.productUpdatedTopic(), SnsEventSourceProps.builder()
                .deadLetterQueue(new Queue(this, "ProductUpdatedEventSourceDLQ", QueueProps.builder()
                        .queueName(String.format("ProductUpdatedEventSourceDLQ-%s", props.sharedProps().env()))
                        .build()))
                .build()));
        
        return handleProductUpdatedEventFunction;
    }
}
