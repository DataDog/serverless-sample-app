package com.cdk.product.publisher;

import com.cdk.constructs.InstrumentedFunction;
import com.cdk.constructs.InstrumentedFunctionProps;
import com.cdk.constructs.ResilientQueue;
import com.cdk.constructs.ResilientQueueProps;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.services.lambda.IFunction;
import software.amazon.awscdk.services.lambda.eventsources.SqsEventSource;
import software.amazon.awscdk.services.lambda.eventsources.SqsEventSourceProps;
import software.amazon.awscdk.services.sns.subscriptions.SqsSubscription;
import software.constructs.Construct;

import java.util.HashMap;

public class ProductEventPublisher extends Construct {
    public ProductEventPublisher(@NotNull Construct scope, @NotNull String id, @NotNull ProductEventPublisherProps props) {
        super(scope, id);

        ResilientQueue queue = new ResilientQueue(this, "ProductPublicEventPublisherQueue", new ResilientQueueProps("ProductEventPublisherQueue", props.sharedProps()));
        
        HashMap<String, String> functionEnvVars = new HashMap<>(2);
        functionEnvVars.put("DD_SERVICE_MAPPING", String.format("lambda_sqs:%s", queue.getQueue().getQueueName()));
        functionEnvVars.put("PRODUCT_CREATED_TOPIC_ARN", props.productCreatedTopic().getTopicArn());
        functionEnvVars.put("PRODUCT_UPDATED_TOPIC_ARN", props.productUpdatedTopic().getTopicArn());
        functionEnvVars.put("PRODUCT_DELETED_TOPIC_ARN", props.productUpdatedTopic().getTopicArn());
        functionEnvVars.put("EVENT_BUS_NAME", props.sharedEventBus().getEventBusName());
        
        String compiledJarFilePath = "../product-event-publisher/target/com.product.publisher-0.0.1-SNAPSHOT-aws.jar";

        IFunction eventPublisherFunction = new InstrumentedFunction(this, "ProductEventPublisherFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.product.publisher", compiledJarFilePath, "handleInternalEvents", functionEnvVars)).getFunction();
        props.sharedEventBus().grantPutEventsTo(eventPublisherFunction);
        
        eventPublisherFunction.addEventSource(new SqsEventSource(queue.getQueue(), SqsEventSourceProps.builder()
                .reportBatchItemFailures(true)
                .maxBatchingWindow(Duration.seconds(10))
                .batchSize(10)
                .build()));
        
        props.productCreatedTopic().addSubscription(new SqsSubscription(queue.getQueue()));
        props.productUpdatedTopic().addSubscription(new SqsSubscription(queue.getQueue()));
        props.productDeletedTopic().addSubscription(new SqsSubscription(queue.getQueue()));
        
    }
}
