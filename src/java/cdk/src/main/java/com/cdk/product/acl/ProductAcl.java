/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.product.acl;

import com.cdk.constructs.InstrumentedFunction;
import com.cdk.constructs.InstrumentedFunctionProps;
import com.cdk.constructs.ResilientQueue;
import com.cdk.constructs.ResilientQueueProps;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.services.events.EventPattern;
import software.amazon.awscdk.services.events.Rule;
import software.amazon.awscdk.services.events.RuleProps;
import software.amazon.awscdk.services.events.targets.SqsQueue;
import software.amazon.awscdk.services.lambda.IFunction;
import software.amazon.awscdk.services.lambda.eventsources.SqsEventSource;
import software.amazon.awscdk.services.lambda.eventsources.SqsEventSourceProps;
import software.amazon.awscdk.services.sns.ITopic;
import software.amazon.awscdk.services.sns.Topic;
import software.amazon.awscdk.services.sns.TopicProps;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.amazon.awscdk.services.ssm.StringParameterProps;
import software.constructs.Construct;

import java.util.HashMap;
import java.util.List;

public class ProductAcl extends Construct {
    public ProductAcl(@NotNull Construct scope, @NotNull String id, @NotNull ProductAclProps props) {
        super(scope, id);

        ITopic productStockUpdatedTopic = new Topic(this, "ProductStockUpdatedTopic", TopicProps.builder()
                .topicName(String.format("JavaProductStockUpdated-%s", props.sharedProps().env()))
                .build());

        ResilientQueue queue = new ResilientQueue(this, "StockUpdatedEventQueue", new ResilientQueueProps("ProductInventoryStockUpdatedQueue", props.sharedProps()));
        
        HashMap<String, String> functionEnvVars = new HashMap<>(2);
        functionEnvVars.put("DD_SERVICE_MAPPING", String.format("lambda_sqs:%s,lambda_sns:%s", queue.getQueue().getQueueName(), productStockUpdatedTopic.getTopicName()));
        functionEnvVars.put("EVENT_BUS_NAME", props.sharedEventBus().getEventBusName());
        functionEnvVars.put("PRODUCT_STOCK_UPDATED_TOPIC_ARN", productStockUpdatedTopic.getTopicArn());
        
        String compiledJarFilePath = "../product-acl/target/com.product.acl-0.0.1-SNAPSHOT-aws.jar";

        IFunction productStockUpdatedHandlerFunction = new InstrumentedFunction(this, "ProductAclFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.product.acl", compiledJarFilePath, "handleStockUpdatedEvent", functionEnvVars)).getFunction();
        productStockUpdatedTopic.grantPublish(productStockUpdatedHandlerFunction);
        
        productStockUpdatedHandlerFunction.addEventSource(new SqsEventSource(queue.getQueue(), SqsEventSourceProps.builder()
                .reportBatchItemFailures(true)
                .maxBatchingWindow(Duration.seconds(10))
                .batchSize(10)
                .build()));

        Rule rule = new Rule(this, "ProductInventoryStockUpdatedRule", RuleProps.builder()
                .eventBus(props.sharedEventBus())
                .build());
        rule.addEventPattern(EventPattern.builder()
                        .detailType(List.of("inventory.stockUpdated.v1"))
                        .source(List.of(String.format("%s.inventory", props.sharedProps().env())))
                .build());
        rule.addTarget(new SqsQueue(queue.getQueue()));

        StringParameter newProductAddedTopicArnParam = new StringParameter(this, "ProductStockUpdatedTopicArn", StringParameterProps.builder()
                .parameterName("/java/product/product-stock-updated-topic")
                .stringValue(productStockUpdatedTopic.getTopicArn())
                .build());
        StringParameter newProductAddedTopicNameParam = new StringParameter(this, "ProductStockUpdatedTopicName", StringParameterProps.builder()
                .parameterName("/java/product/product-stock-updated-topic-name")
                .stringValue(productStockUpdatedTopic.getTopicName())
                .build());
    }
}
