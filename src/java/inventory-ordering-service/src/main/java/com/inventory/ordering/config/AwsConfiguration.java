/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.ordering.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.services.sfn.SfnClient;

@Configuration
public class AwsConfiguration {
    @Bean
    public SfnClient awsStepFunctions() {
        return SfnClient.builder().build();
    }
}
