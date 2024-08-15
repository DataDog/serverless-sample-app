package com.inventory.ordering.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.inventory.ordering.FunctionConfiguration;

@Configuration
public class LoggingConfiguration {
    @Bean
    public Logger logger() {
        return LoggerFactory.getLogger(FunctionConfiguration.class);
    }
}
