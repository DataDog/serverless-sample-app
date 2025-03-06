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
import com.cdk.events.OrderCompletedEvent;
import com.cdk.events.OrderCreatedEvent;
import com.cdk.events.ProductCreatedEvent;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.services.connect.CfnQuickConnect;
import software.amazon.awscdk.services.events.EventPattern;
import software.amazon.awscdk.services.events.IRule;
import software.amazon.awscdk.services.events.Rule;
import software.amazon.awscdk.services.events.RuleProps;
import software.amazon.awscdk.services.events.targets.SqsQueue;
import software.amazon.awscdk.services.iam.Effect;
import software.amazon.awscdk.services.iam.PolicyStatement;
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

        HashMap<String, String> productCreatedFunctionEnvVars = new HashMap<>(2);
        productCreatedFunctionEnvVars.put("EVENT_BUS_NAME", props.sharedEventBus().getEventBusName());
        productCreatedFunctionEnvVars.put("PRODUCT_ADDED_TOPIC_ARN", newProductAddedTopic.getTopicArn());

        String compiledJarFilePath = "../inventory-acl/target/function.zip";

        IFunction productCreatedEventHandlerFunction = new InstrumentedFunction(this, "InventoryAclFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.inventory.acl", compiledJarFilePath, "handleProductCreated", productCreatedFunctionEnvVars, true)).getFunction();
        newProductAddedTopic.grantPublish(productCreatedEventHandlerFunction);
        productCreatedEventHandlerFunction.addToRolePolicy(PolicyStatement.Builder.create()
                .effect(Effect.ALLOW)
                .resources(List.of("*"))
                .actions(List.of("events:ListEventBuses"))
                .build());

        productCreatedEventHandlerFunction.addEventSource(new SqsEventSource(queue.getQueue(), SqsEventSourceProps.builder()
                .reportBatchItemFailures(true)
                .maxBatchingWindow(Duration.seconds(10))
                .batchSize(10)
                .build()));

        Rule rule = new ProductCreatedEvent(this, "InventoryProductCreatedRule", props.sharedProps(), props.sharedEventBus());
        rule.addTarget(new SqsQueue(queue.getQueue()));

        ResilientQueue orderCreatedQueue = new ResilientQueue(this, "OrderCreatedEventQueue", new ResilientQueueProps("InventoryOrderCreatedEventQueue", props.sharedProps()));

        HashMap<String, String> orderCreatedFunctionEnvVars = new HashMap<>(2);
        orderCreatedFunctionEnvVars.put("EVENT_BUS_NAME", props.sharedEventBus().getEventBusName());
        orderCreatedFunctionEnvVars.put("TABLE_NAME", props.inventoryTable().getTableName());

        IFunction orderCreatedFunction = new InstrumentedFunction(this, "OrderCreatedACLFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.inventory.acl", compiledJarFilePath, "handleOrderCreated", orderCreatedFunctionEnvVars, true)).getFunction();

        orderCreatedFunction.addEventSource(new SqsEventSource(orderCreatedQueue.getQueue(), SqsEventSourceProps.builder()
                .reportBatchItemFailures(true)
                .maxBatchingWindow(Duration.seconds(10))
                .batchSize(10)
                .build()));
        props.sharedEventBus().grantPutEventsTo(orderCreatedFunction);
        orderCreatedFunction.addToRolePolicy(PolicyStatement.Builder.create()
                .effect(Effect.ALLOW)
                .resources(List.of("*"))
                .actions(List.of("events:ListEventBuses"))
                .build());
        props.inventoryTable().grantReadWriteData(orderCreatedFunction);

        Rule orderCreatedRule = new OrderCreatedEvent(this, "InventoryOrderCreatedRule", props.sharedProps(), props.sharedEventBus());
        orderCreatedRule.addTarget(new SqsQueue(orderCreatedQueue.getQueue()));

        ResilientQueue orderCompletedQueue = new ResilientQueue(this, "OrderCompletedEventQueue", new ResilientQueueProps("InventoryOrderCompletedEventQueue", props.sharedProps()));

        HashMap<String, String> orderCompletedFunctionEnvVars = new HashMap<>(2);
        orderCompletedFunctionEnvVars.put("EVENT_BUS_NAME", props.sharedEventBus().getEventBusName());
        orderCompletedFunctionEnvVars.put("TABLE_NAME", props.inventoryTable().getTableName());

        IFunction orderCompletedFunction = new InstrumentedFunction(this, "OrderCompletedACLFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.inventory.acl", compiledJarFilePath, "handleOrderCompleted", orderCompletedFunctionEnvVars, true)).getFunction();

        orderCompletedFunction.addEventSource(new SqsEventSource(orderCompletedQueue.getQueue(), SqsEventSourceProps.builder()
                .reportBatchItemFailures(true)
                .maxBatchingWindow(Duration.seconds(10))
                .batchSize(10)
                .build()));
        props.sharedEventBus().grantPutEventsTo(orderCompletedFunction);
        orderCreatedFunction.addToRolePolicy(PolicyStatement.Builder.create()
                .effect(Effect.ALLOW)
                .resources(List.of("*"))
                .actions(List.of("events:ListEventBuses"))
                .build());
        props.inventoryTable().grantReadWriteData(orderCompletedFunction);

        Rule orderCompletedRule = new OrderCompletedEvent(this, "InventoryOrderCompletedRule", props.sharedProps(),props.sharedEventBus());
        orderCompletedRule.addTarget(new SqsQueue(orderCompletedQueue.getQueue()));
    }

    public ITopic getNewProductAddedTopic() {
        return newProductAddedTopic;
    }
}
