/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk;

import software.amazon.awscdk.App;
import software.amazon.awscdk.StackProps;

public class InventoryService {
    public static void main(final String[] args) {
        App app = new App();

        String env = System.getenv("ENV") == null ? "dev" : System.getenv("ENV");

        new InventoryServiceStack(app, "InventoryService", StackProps.builder()
                .stackName(String.format("InventoryService-%s", env))
                .build());
        
        app.synth();
    }
}

