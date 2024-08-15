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
    public InventoryAcl(@NotNull Construct scope, @NotNull String id, @NotNull InventoryAclProps props) {
        super(scope, id);

        ITopic newProductAddedTopic = new Topic(this, "NewProductAddedTopic", TopicProps.builder()
                .topicName(String.format("JavaInventoryNewProductAddedTopic-%s", props.sharedProps().env()))
                .build());

        ResilientQueue queue = new ResilientQueue(this, "ProductCreatedEventQueue", new ResilientQueueProps("InventoryProductCreatedEventQueue", props.sharedProps()));
        
        HashMap<String, String> functionEnvVars = new HashMap<>(2);
        functionEnvVars.put("DD_SERVICE_MAPPING", String.format("lambda_sqs:%s,lambda_sns:%s", queue.getQueue().getQueueName(), newProductAddedTopic.getTopicName()));
        functionEnvVars.put("EVENT_BUS_NAME", props.sharedEventBus().getEventBusName());
        functionEnvVars.put("NEW_PRODUCT_ADDED_TOPIC_ARN", newProductAddedTopic.getTopicArn());
        
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

        StringParameter newProductAddedTopicArnParam = new StringParameter(this, "ProductAddedTopicArn", StringParameterProps.builder()
                .parameterName("/java/inventory/product-added-topic")
                .stringValue(newProductAddedTopic.getTopicArn())
                .build());
        StringParameter newProductAddedTopicNameParam = new StringParameter(this, "ProductAddedTopicName", StringParameterProps.builder()
                .parameterName("/java/inventory/product-added-topic-name")
                .stringValue(newProductAddedTopic.getTopicName())
                .build());
    }
}
