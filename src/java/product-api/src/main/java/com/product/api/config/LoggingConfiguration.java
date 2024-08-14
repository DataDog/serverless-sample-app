package com.product.api.config;

import com.product.api.FunctionConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class LoggingConfiguration {
    @Bean
    public Logger logger() {
        return LoggerFactory.getLogger(FunctionConfiguration.class);
    }
}
