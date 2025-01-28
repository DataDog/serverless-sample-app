/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.product.acl;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.events.EventBus;
import software.amazon.awscdk.services.events.IEventBus;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.Secret;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.constructs.Construct;

public class ProductAclStack extends Stack {

    public ProductAclStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        ISecret ddApiKeySecret = Secret.fromSecretCompleteArn(this, "DDApiKeySecret", System.getenv("DD_API_KEY_SECRET_ARN"));
        
        String serviceName = "JavaProductAcl";
        String env = System.getenv("ENV") == null ? "dev" : System.getenv("ENV");
        String version = System.getenv("VERSION") == null ? "dev" : System.getenv("VERSION");
        
        SharedProps sharedProps = new SharedProps(serviceName, env, version, ddApiKeySecret);
        
        String eventBusName = StringParameter.valueForStringParameter(this, "/java/shared/event-bus-name");
        IEventBus sharedBus = EventBus.fromEventBusName(this, "SharedEventBus", eventBusName);
        
        new ProductAcl(this, "JavaProductAcl", new ProductAclProps(sharedProps, sharedBus));
    }
}
