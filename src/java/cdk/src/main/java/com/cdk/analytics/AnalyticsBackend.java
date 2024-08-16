/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.analytics;

import com.cdk.constructs.InstrumentedFunction;
import com.cdk.constructs.InstrumentedFunctionProps;
import com.cdk.constructs.ResilientQueue;
import com.cdk.constructs.ResilientQueueProps;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.services.events.EventPattern;
import software.amazon.awscdk.services.events.Match;
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

public class AnalyticsBackend extends Construct {
    public AnalyticsBackend(@NotNull Construct scope, @NotNull String id, @NotNull AnalyticsBackendProps props) {
        super(scope, id);

        ResilientQueue queue = new ResilientQueue(this, "EventAnalyticsQueue", new ResilientQueueProps("EventAnalyticsQueue", props.sharedProps()));
        
        HashMap<String, String> functionEnvVars = new HashMap<>(2);
        functionEnvVars.put("DD_SERVICE_MAPPING", String.format("lambda_sqs:%s", queue.getQueue().getQueueName()));
        functionEnvVars.put("EVENT_BUS_NAME", props.sharedEventBus().getEventBusName());
        functionEnvVars.put("DD_TRACE_PROPAGATION_STYLE", "none");
        functionEnvVars.put("DD_TRACE_PROPAGATION_STYLE_EXTRACT", "none");
        functionEnvVars.put("DD_TRACE_OTEL_ENABLED", "true");
        
        String compiledJarFilePath = "../analytics-backend/target/com.analytics-0.0.1-SNAPSHOT-aws.jar";

        IFunction productCreatedEventHandlerFunction = new InstrumentedFunction(this, "AnalyticsBackendFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.analytics", compiledJarFilePath, "handleEvents", functionEnvVars)).getFunction();
        
        productCreatedEventHandlerFunction.addEventSource(new SqsEventSource(queue.getQueue(), SqsEventSourceProps.builder()
                .reportBatchItemFailures(true)
                .maxBatchingWindow(Duration.seconds(10))
                .batchSize(10)
                .build()));

        Rule rule = new Rule(this, "AnalyticsCatchAllRule", RuleProps.builder()
                .eventBus(props.sharedEventBus())
                .build());
        rule.addEventPattern(EventPattern.builder()
                        .source(Match.prefix(props.sharedProps().env()))
                .build());
        rule.addTarget(new SqsQueue(queue.getQueue()));
    }
}
