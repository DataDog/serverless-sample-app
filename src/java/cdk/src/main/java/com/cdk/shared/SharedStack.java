/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.shared;

import software.amazon.awscdk.services.events.EventBus;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.amazon.awscdk.services.ssm.StringParameterProps;
import software.constructs.Construct;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;

public class SharedStack extends Stack {

    public SharedStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);
        
        var bus = new EventBus(this, "TracedJavaBus");

        new StringParameter(this, "BusNameParam", StringParameterProps.builder()
                .parameterName("/java/shared/event-bus-name")
                .stringValue(bus.getEventBusName())
                .build());
    }
}
