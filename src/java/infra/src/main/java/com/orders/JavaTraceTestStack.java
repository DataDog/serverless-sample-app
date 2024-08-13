package com.orders;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.CfnOutputProps;
import software.amazon.awscdk.services.events.EventBus;
import software.amazon.awscdk.services.events.EventPattern;
import software.amazon.awscdk.services.events.Rule;
import software.amazon.awscdk.services.events.RuleProps;
import software.amazon.awscdk.services.events.targets.LambdaFunction;
import software.amazon.awscdk.services.events.targets.SqsQueue;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.Secret;
import software.amazon.awscdk.services.sns.subscriptions.LambdaSubscription;
import software.amazon.awscdk.services.sns.subscriptions.SqsSubscription;
import software.constructs.Construct;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;

import java.util.List;
import java.util.Map;

public class JavaTraceTestStack extends Stack {
    public JavaTraceTestStack(final Construct scope, final String id) {
        this(scope, id, null);
    }

    public JavaTraceTestStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        ISecret ddApiKeySecret = Secret.fromSecretCompleteArn(this, "DDApiKeySecret", System.getenv("DD_SECRET_ARN"));
        
        String serviceName = "java-trace-test";
        String env = "java-trace-test";
        String version = "java-trace-test";
        
        SharedProps sharedProps = new SharedProps(serviceName, env, version, ddApiKeySecret);
        
        var bus = new EventBus(this, "TracedJavaBus");
        
        var api = new Api(this, "TracedJavaApiService", new ApiProps(sharedProps));
        
        var backgroundWorkers = new BackgroundWorkers(this, "TracedJavaBackgroundServices", new BackgroundWorkersProps(sharedProps, bus));
        
        api.getTopic().addSubscription(new SqsSubscription(backgroundWorkers.getSnsConsumerQueue()));
        api.getTopic().addSubscription(new LambdaSubscription(backgroundWorkers.getSnsConsumerFunction()));
        
        var rule = new Rule(this, "OrderCreatedEventRule", RuleProps.builder()
                .eventBus(bus)
                .build());
        rule.addEventPattern(EventPattern.builder()
                .source(List.of(String.format("%s.orders", env)))
                .detailType(List.of("order.orderConfirmed")).build());
        rule.addTarget(new SqsQueue(backgroundWorkers.getEventBridgeConsumerQueue()));
        rule.addTarget(new LambdaFunction(backgroundWorkers.getEventBridgeConsumerFunction()));
        
        var apiEndpointOutput = new CfnOutput(this, "JavaApiUrlOutput", CfnOutputProps.builder()
                .value(api.getApi().getApiEndpoint())
                .exportName("ApiEndpoint")
                .build());
    }
}
