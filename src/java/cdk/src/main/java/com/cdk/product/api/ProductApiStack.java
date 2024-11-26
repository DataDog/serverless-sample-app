/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.product.api;

import com.cdk.constructs.SharedProps;
import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.CfnOutputProps;
import software.amazon.awscdk.services.events.EventBus;
import software.amazon.awscdk.services.secretsmanager.ISecret;
import software.amazon.awscdk.services.secretsmanager.Secret;
import software.constructs.Construct;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;

public class ProductApiStack extends Stack {
    public ProductApiStack(final Construct scope, final String id) {
        this(scope, id, null);
    }

    public ProductApiStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        ISecret ddApiKeySecret = Secret.fromSecretCompleteArn(this, "DDApiKeySecret", System.getenv("DD_API_KEY_SECRET_ARN"));
        
        String serviceName = "JavaProductApi";
        String env = System.getenv("ENV") == null ? "dev" : System.getenv("ENV");
        String version = System.getenv("VERSION") == null ? "dev" : System.getenv("VERSION");
        
        SharedProps sharedProps = new SharedProps(serviceName, env, version, ddApiKeySecret);
        
        var api = new ProductApi(this, "JavaProductApi", new ProductApiProps(sharedProps));
        
        var apiEndpointOutput = new CfnOutput(this, "JavaApiUrlOutput", CfnOutputProps.builder()
                .value(api.getApi().getUrl())
                .exportName("ApiEndpoint")
                .build());
    }
}
