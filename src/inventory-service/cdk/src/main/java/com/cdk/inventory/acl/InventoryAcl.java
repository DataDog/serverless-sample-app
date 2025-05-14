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
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.services.events.Rule;
import software.amazon.awscdk.services.events.targets.LambdaFunction;
import software.amazon.awscdk.services.events.targets.SqsQueue;
import software.amazon.awscdk.services.iam.Effect;
import software.amazon.awscdk.services.iam.Policy;
import software.amazon.awscdk.services.iam.PolicyDocument;
import software.amazon.awscdk.services.iam.PolicyStatement;
import software.amazon.awscdk.services.lambda.IFunction;
import software.amazon.awscdk.services.lambda.eventsources.SqsEventSource;
import software.amazon.awscdk.services.lambda.eventsources.SqsEventSourceProps;
import software.amazon.awscdk.services.sns.ITopic;
import software.amazon.awscdk.services.sns.Topic;
import software.amazon.awscdk.services.sns.TopicProps;
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
        productCreatedFunctionEnvVars.put("EVENT_BUS_NAME", props.publisherBus().getEventBusName());
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

        Rule rule = new ProductCreatedEvent(this, "InventoryProductCreatedRule", props.sharedProps(), props.subscriberBus());
        rule.addTarget(new SqsQueue(queue.getQueue()));

        ResilientQueue orderCreatedQueue = new ResilientQueue(this, "OrderCreatedEventQueue", new ResilientQueueProps("InventoryOrderCreatedEventQueue", props.sharedProps()));

        IFunction orderCreatedFunction = createOrderCreatedFunction(props, compiledJarFilePath);

        orderCreatedFunction.addEventSource(new SqsEventSource(orderCreatedQueue.getQueue(), SqsEventSourceProps.builder()
                .reportBatchItemFailures(true)
                .maxBatchingWindow(Duration.seconds(10))
                .batchSize(10)
                .build()));
        props.publisherBus().grantPutEventsTo(orderCreatedFunction);
        orderCreatedFunction.addToRolePolicy(PolicyStatement.Builder.create()
                .effect(Effect.ALLOW)
                .resources(List.of("*"))
                .actions(List.of("events:ListEventBuses"))
                .build());
        props.inventoryTable().grantReadWriteData(orderCreatedFunction);

        Rule orderCreatedRule = new OrderCreatedEvent(this, "InventoryOrderCreatedRule", props.sharedProps(), props.subscriberBus());
        orderCreatedRule.addTarget(new SqsQueue(orderCreatedQueue.getQueue()));

        ResilientQueue orderCompletedQueue = new ResilientQueue(this, "OrderCompletedEventQueue", new ResilientQueueProps("InventoryOrderCompletedEventQueue", props.sharedProps()));

        HashMap<String, String> orderCompletedFunctionEnvVars = new HashMap<>(2);
        orderCompletedFunctionEnvVars.put("EVENT_BUS_NAME", props.publisherBus().getEventBusName());
        orderCompletedFunctionEnvVars.put("TABLE_NAME", props.inventoryTable().getTableName());

        IFunction orderCompletedFunction = new InstrumentedFunction(this, "OrderCompletedACLFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.inventory.acl", compiledJarFilePath, "handleOrderCompleted", orderCompletedFunctionEnvVars, true)).getFunction();

        orderCompletedFunction.addEventSource(new SqsEventSource(orderCompletedQueue.getQueue(), SqsEventSourceProps.builder()
                .reportBatchItemFailures(true)
                .maxBatchingWindow(Duration.seconds(10))
                .batchSize(10)
                .build()));
        props.publisherBus().grantPutEventsTo(orderCompletedFunction);
        orderCompletedFunction.addToRolePolicy(PolicyStatement.Builder.create()
                .effect(Effect.ALLOW)
                .resources(List.of("*"))
                .actions(List.of("events:ListEventBuses"))
                .build());
        props.inventoryTable().grantReadWriteData(orderCompletedFunction);

        Rule orderCompletedRule = new OrderCompletedEvent(this, "InventoryOrderCompletedRule", props.sharedProps(),props.subscriberBus());
        orderCompletedRule.addTarget(new SqsQueue(orderCompletedQueue.getQueue()));

        IFunction productCatalogueRefreshFunction = getProductCatalogueRefreshFunction(props, newProductAddedTopic, compiledJarFilePath);
    }

    private IFunction createOrderCreatedFunction(@NotNull InventoryAclProps props, String compiledJarFilePath) {
        HashMap<String, String> orderCreatedFunctionEnvVars = new HashMap<>(2);
        orderCreatedFunctionEnvVars.put("EVENT_BUS_NAME", props.publisherBus().getEventBusName());
        orderCreatedFunctionEnvVars.put("TABLE_NAME", props.inventoryTable().getTableName());

        return new InstrumentedFunction(this, "OrderCreatedACLFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.inventory.acl", compiledJarFilePath, "handleOrderCreated", orderCreatedFunctionEnvVars, true)).getFunction();
    }

    private IFunction getProductCatalogueRefreshFunction(@NotNull InventoryAclProps props, ITopic newProductAddedTopic, String compiledJarFilePath) {
        var productApiEndpointParameterName = String.format("/%s/ProductService/api-endpoint", props.sharedProps().env());

        HashMap<String, String> productCatalogueRefreshFunctionEnvVars = new HashMap<>(4);
        productCatalogueRefreshFunctionEnvVars.put("EVENT_BUS_NAME", props.publisherBus().getEventBusName());
        productCatalogueRefreshFunctionEnvVars.put("TABLE_NAME", props.inventoryTable().getTableName());
        productCatalogueRefreshFunctionEnvVars.put("PRODUCT_ADDED_TOPIC_ARN", newProductAddedTopic.getTopicArn());
        productCatalogueRefreshFunctionEnvVars.put("PRODUCT_API_ENDPOINT_PARAMETER", productApiEndpointParameterName);

        IFunction productCatalogueRefreshFunction = new InstrumentedFunction(this, "ProductRefreshFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.inventory.acl", compiledJarFilePath, "handleProductCatalogueRefresh", productCatalogueRefreshFunctionEnvVars, true)).getFunction();
        var everyOneMinuteScheduleRule = Rule.Builder.create(this, "EveryOneMinuteScheduleRule")
                .schedule(software.amazon.awscdk.services.events.Schedule.rate(Duration.minutes(1)))
                .build();
        props.inventoryTable().grantReadData(productCatalogueRefreshFunction);
        newProductAddedTopic.grantPublish(productCatalogueRefreshFunction);

        everyOneMinuteScheduleRule.addTarget(new LambdaFunction(productCatalogueRefreshFunction));
        PolicyStatement readSsmParameterPolicy = PolicyStatement.Builder.create()
                .effect(Effect.ALLOW)
                .actions(List.of("ssm:GetParameter", "ssm:DescribeParameters", "ssm:GetParameterHistory", "ssm:GetParameters"))
                .resources(List.of(String.format("arn:aws:ssm:%s:%s:parameter%s", Stack.of(this).getRegion(), Stack.of(this).getAccount(), productApiEndpointParameterName)))
                .build();
        Policy readySsmParameterPolicy = Policy.Builder.create(this, "ReadProductApiEndpointParameter")
                .policyName("AllowReadOfProductApiEndpoint")
                .document(PolicyDocument.Builder.create()
                        .statements(List.of(readSsmParameterPolicy))
                        .build())
                .build();
        productCatalogueRefreshFunction.getRole().attachInlinePolicy(readySsmParameterPolicy);
        productCatalogueRefreshFunction.addToRolePolicy(PolicyStatement.Builder.create()
                .effect(Effect.ALLOW)
                .resources(List.of("*"))
                .actions(List.of("events:ListEventBuses"))
                .build());
        return productCatalogueRefreshFunction;
    }

    public ITopic getNewProductAddedTopic() {
        return newProductAddedTopic;
    }
}
