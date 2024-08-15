package com.inventory.ordering.config;

import com.amazonaws.services.stepfunctions.AWSStepFunctions;
import com.amazonaws.services.stepfunctions.AWSStepFunctionsClientBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AwsConfiguration {
    @Bean
    public AWSStepFunctions awsStepFunctions() {
        return AWSStepFunctionsClientBuilder.standard().build();
    }
}
