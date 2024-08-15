package com.inventory.acl.config;

import com.amazonaws.services.sns.AmazonSNS;
import com.amazonaws.services.sns.AmazonSNSClientBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AwsConfiguration {
    @Bean
    public AmazonSNS amazonSNS() {
        return AmazonSNSClientBuilder.standard().build();
    }
}
