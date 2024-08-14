package com.cdk.shared;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.CfnOutputProps;
import software.amazon.awscdk.services.events.EventBus;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.Secret;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.amazon.awscdk.services.ssm.StringParameterProps;
import software.constructs.Construct;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;

public class SharedStack extends Stack {
    public SharedStack(final Construct scope, final String id) {
        this(scope, id, null);
    }

    public SharedStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);
        
        var bus = new EventBus(this, "TracedJavaBus");

        StringParameter busNameParam = new StringParameter(this, "BusNameParam", StringParameterProps.builder()
                .parameterName("/java/shared/event-bus-name")
                .stringValue(bus.getEventBusName())
                .build());
    }
}
