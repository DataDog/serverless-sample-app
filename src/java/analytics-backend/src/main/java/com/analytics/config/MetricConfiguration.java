package com.analytics.config;

import com.timgroup.statsd.ConvenienceMethodProvidingStatsDClient;
import com.timgroup.statsd.NonBlockingStatsDClient;
import com.timgroup.statsd.StatsDClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MetricConfiguration {
    
    @Bean
    public StatsDClient getStatsDClient() {
        return new NonBlockingStatsDClient("statsd", "localhost", 8125);
    }
}
