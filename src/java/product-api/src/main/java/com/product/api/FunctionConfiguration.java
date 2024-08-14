package com.product.api;

import com.amazonaws.services.lambda.runtime.events.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.api.core.*;
import com.product.api.core.events.internal.ProductPriceCalculatedEvent;

import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

import java.util.Collections;
import java.util.Map;
import java.util.function.Function;

@SpringBootApplication(scanBasePackages = "com.product.api")
public class FunctionConfiguration {
    @Autowired
    ObjectMapper objectMapper;
    @Autowired
    ProductService service;
    @Autowired
    Logger logger;

    public static void main(String[] args) {
        SpringApplication.run(FunctionConfiguration.class, args);
    }

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

    @Bean
    public Function<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> handleCreateProduct() {
        return value -> {
            if (value.getBody() == null) {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(400)
                        .withBody("{}")
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            }

            try {
                CreateProductRequest request = this.objectMapper.readValue(value.getBody(), CreateProductRequest.class);

                var result = this.service.createProduct(request);

                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(result.isSuccess() ? 201 : 400)
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

    @Bean
    public Function<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> handleDeleteProduct() {
        return value -> {
            if (!value.getPathParameters().containsKey("productId")) {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(400)
                        .withBody("{}")
                        .withHeaders(Map.of("Content-Type", "application/json"))
                        .build();
            }

            String productId = value.getPathParameters().get("productId");

            HandlerResponse<Boolean> result = service.deleteProduct(productId);

            try {
                return APIGatewayV2HTTPResponse.builder()
                        .withStatusCode(result.isSuccess() ? 200 : 404)
                        .withBody(this.objectMapper.writeValueAsString(result))
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

    @Bean
    public Function<SNSEvent, String> handlePricingChanged() {
        return value -> {
            final Span span = GlobalTracer.get().activeSpan();

            try {
                for (SNSEvent.SNSRecord record : value.getRecords()) {
                    logger.info("Handling pricing changed event");
                    ProductPriceCalculatedEvent evt = this.objectMapper.readValue(record.getSNS().getMessage(), ProductPriceCalculatedEvent.class);
                    
                    logger.info(String.format("Handling pricing changed for product %s", evt.getProductId()));
                    span.setTag("product.id", evt.getProductId());

                    this.service.handleProductPriceCalculatedEvent(evt);
                }
            } catch (JsonProcessingException | Error exception) {
                logger.error("An exception occurred!", exception);
                span.setTag(Tags.ERROR, true);
                span.log(Collections.singletonMap(Fields.ERROR_OBJECT, exception));
            }

            return "OK";
        };
    }
}
