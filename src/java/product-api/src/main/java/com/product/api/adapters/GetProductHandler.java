package com.product.api.adapters;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.api.core.HandlerResponse;
import com.product.api.core.ProductDTO;
import com.product.api.core.ProductService;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;

import java.util.Map;
import java.util.function.Function;

public class GetProductHandler {
    @Autowired
    ObjectMapper objectMapper;
    @Autowired
    ProductService service;
    @Autowired
    Logger logger;

    @Bean
    public Function<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> handleGetProduct() {
        return value -> {
            if (!value.getPathParameters().containsKey("productId")) {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(400)
                        .withBody("{}")
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            }

            String productId = value.getPathParameters().get("productId");

            HandlerResponse<ProductDTO> productDTO = service.getProduct(productId);

            try {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(productDTO.isSuccess() ? 200 : 404)
                        .withBody(this.objectMapper.writeValueAsString(productDTO))
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            } catch (JsonProcessingException e) {
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
