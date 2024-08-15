package com.product.publisher.config;

import com.amazonaws.services.eventbridge.AmazonEventBridge;
import com.amazonaws.services.eventbridge.AmazonEventBridgeAsyncClientBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AwsConfiguration {
    @Bean
    public AmazonEventBridge amazonSNS() {
        return AmazonEventBridgeAsyncClientBuilder.standard().build();
    }
}
