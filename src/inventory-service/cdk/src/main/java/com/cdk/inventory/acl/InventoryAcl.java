/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.inventory.acl;

import com.cdk.constructs.InstrumentedFunction;
import com.cdk.constructs.InstrumentedFunctionProps;
import com.cdk.constructs.ResilientQueue;
import com.cdk.constructs.ResilientQueueProps;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.services.connect.CfnQuickConnect;
import software.amazon.awscdk.services.events.EventPattern;
import software.amazon.awscdk.services.events.IRule;
import software.amazon.awscdk.services.events.Rule;
import software.amazon.awscdk.services.events.RuleProps;
import software.amazon.awscdk.services.events.targets.SqsQueue;
import software.amazon.awscdk.services.lambda.IFunction;
import software.amazon.awscdk.services.lambda.eventsources.SqsEventSource;
import software.amazon.awscdk.services.lambda.eventsources.SqsEventSourceProps;
import software.amazon.awscdk.services.sns.ITopic;
import software.amazon.awscdk.services.sns.Topic;
import software.amazon.awscdk.services.sns.TopicProps;
import software.amazon.awscdk.services.sns.subscriptions.SqsSubscription;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.amazon.awscdk.services.ssm.StringParameterProps;
import software.constructs.Construct;

import java.util.HashMap;
import java.util.List;

public class InventoryAcl extends Construct {
    private ITopic newProductAddedTopic;
    public InventoryAcl(@NotNull Construct scope, @NotNull String id, @NotNull InventoryAclProps props) {
        super(scope, id);

        this.newProductAddedTopic = new Topic(this, "NewProductAddedTopic", TopicProps.builder()
                .topicName(String.format("InventoryNewProductAddedTopic-%s", props.sharedProps().env()))
                .build());

        ResilientQueue queue = new ResilientQueue(this, "ProductCreatedEventQueue", new ResilientQueueProps("InventoryProductCreatedEventQueue", props.sharedProps()));

        HashMap<String, String> functionEnvVars = new HashMap<>(2);
        functionEnvVars.put("EVENT_BUS_NAME", props.sharedEventBus().getEventBusName());
        functionEnvVars.put("PRODUCT_ADDED_TOPIC_ARN", newProductAddedTopic.getTopicArn());

        String compiledJarFilePath = "../inventory-acl/target/com.inventory.acl-0.0.1-SNAPSHOT-aws.jar";

        IFunction productCreatedEventHandlerFunction = new InstrumentedFunction(this, "InventoryAclFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.inventory.acl", compiledJarFilePath, "handleProductCreatedEvent", functionEnvVars)).getFunction();
        newProductAddedTopic.grantPublish(productCreatedEventHandlerFunction);

        productCreatedEventHandlerFunction.addEventSource(new SqsEventSource(queue.getQueue(), SqsEventSourceProps.builder()
                .reportBatchItemFailures(true)
                .maxBatchingWindow(Duration.seconds(10))
                .batchSize(10)
                .build()));

        Rule rule = new Rule(this, "InventoryProductCreatedRule", RuleProps.builder()
                .eventBus(props.sharedEventBus())
                .build());
        rule.addEventPattern(EventPattern.builder()
                        .detailType(List.of("product.productCreated.v1"))
                        .source(List.of(String.format("%s.products", props.sharedProps().env())))
                .build());
        rule.addTarget(new SqsQueue(queue.getQueue()));
    }

    public ITopic getNewProductAddedTopic() {
        return newProductAddedTopic;
    }
}
