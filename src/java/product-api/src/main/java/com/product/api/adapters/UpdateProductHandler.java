package com.product.api.adapters;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.api.core.ProductService;
import com.product.api.core.UpdateProductRequest;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;

import java.util.Map;
import java.util.function.Function;

public class UpdateProductHandler {
    @Autowired
    ObjectMapper objectMapper;
    @Autowired
    ProductService service;
    @Autowired
    Logger logger;
    @Bean
    public Function<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> handleUpdateProduct() {
        return value -> {
            if (value.getBody() == null) {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(400)
                        .withBody("{}")
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            }

            try {
                UpdateProductRequest request = this.objectMapper.readValue(value.getBody(), UpdateProductRequest.class);

                var result = this.service.updateProduct(request);

                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(result.isSuccess() ? 200 : 400)
                        .withBody(this.objectMapper.writeValueAsString(result))
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            } catch (JsonProcessingException | Error e) {
                logger.error("an exception occurred", e);

                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(500)
                        .withBody("{}")
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            }
        };
    }
}
