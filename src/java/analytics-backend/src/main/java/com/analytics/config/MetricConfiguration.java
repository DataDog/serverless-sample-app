/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.analytics.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.timgroup.statsd.NonBlockingStatsDClientBuilder;
import com.timgroup.statsd.StatsDClient;

@Configuration
public class MetricConfiguration {
    
    @Bean
    public StatsDClient getStatsDClient() {
        return new NonBlockingStatsDClientBuilder().hostname("localhost").build();
    }
}
