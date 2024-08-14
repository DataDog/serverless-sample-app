package com.product.api.config;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBAsyncClientBuilder;
import com.amazonaws.services.sns.AmazonSNS;
import com.amazonaws.services.sns.AmazonSNSAsyncClientBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AwsConfiguration {
    @Bean
    public AmazonDynamoDB amazonDynamoDB() {
        return AmazonDynamoDBAsyncClientBuilder.standard().build();
    }
    @Bean
    public AmazonSNS amazonSNS() {
        return AmazonSNSAsyncClientBuilder.standard().build();
    }
}
