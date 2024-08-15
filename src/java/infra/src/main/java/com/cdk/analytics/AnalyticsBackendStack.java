package com.cdk.analytics;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.events.EventBus;
import software.amazon.awscdk.services.events.IEventBus;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.Secret;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.constructs.Construct;

public class AnalyticsBackendStack extends Stack {

    public AnalyticsBackendStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        ISecret ddApiKeySecret = Secret.fromSecretCompleteArn(this, "DDApiKeySecret", System.getenv("DD_SECRET_ARN"));
        
        String serviceName = "JavaAnalyticsBackend";
        String env = "dev";
        String version = "latest";
        
        SharedProps sharedProps = new SharedProps(serviceName, env, version, ddApiKeySecret);
        
        String eventBusName = StringParameter.valueForStringParameter(this, "/java/shared/event-bus-name");
        IEventBus sharedBus = EventBus.fromEventBusName(this, "SharedEventBus", eventBusName);
        
        new AnalyticsBackend(this, "JavaAnalyticsBackend", new AnalyticsBackendProps(sharedProps, sharedBus));
    }
}
