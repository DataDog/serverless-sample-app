/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk;

import software.amazon.awscdk.App;
import software.amazon.awscdk.Tags;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;

public class InventoryService {
    public static void main(final String[] args) {
        App app = new App();

        String env = System.getenv("ENV") == null ? "dev" : System.getenv("ENV");

        var stack = new InventoryServiceStack(app, "InventoryService", StackProps.builder()
                .stackName(String.format("InventoryService-%s", env))
                .env(Environment.builder()
                        .account(System.getenv("CDK_DEFAULT_ACCOUNT"))
                        .region(System.getenv("CDK_DEFAULT_REGION"))
                        .build())
                .build());

        Tags.of(stack).add("env", env);
        Tags.of(stack).add("project", "serverless-sample-app");
        Tags.of(stack).add("service", "inventory-service");
        Tags.of(stack).add("team", "advocacy");
        Tags.of(stack).add("primary-owner", "james@datadog.com");
        
        app.synth();
    }
}

