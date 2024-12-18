/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.core;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.product.api.core.events.internal.ProductPriceCalculatedEvent;

import io.opentracing.Span;
import io.opentracing.log.Fields;
import io.opentracing.tag.Tags;
import io.opentracing.util.GlobalTracer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Service
public class ProductService {
    private final ProductRepository repository;
    private final EventPublisher eventPublisher;
    private final Logger logger = LoggerFactory.getLogger(ProductService.class);

    public ProductService(ProductRepository repository, EventPublisher eventPublisher) {
        this.repository = repository;
        this.eventPublisher = eventPublisher;
    }

    public HandlerResponse<List<ProductDTO>> listProducts() {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            var products = this.repository.listProducts();

            ArrayList<ProductDTO> productResponse = new ArrayList<>();

            for (Product product : products) {
                productResponse.add(new ProductDTO(product));
            }

            return new HandlerResponse<>(productResponse, List.of("OK"), true);
        } catch (Error error) {
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));

            return new HandlerResponse<>(null, List.of("Unknown error"), false);
        }
    }

    public HandlerResponse<ProductDTO> getProduct(String productId) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            this.logger.info(String.format("Received request for product %s", productId));

            span.setTag("product.id", productId);

            Product existingProduct = this.repository.getProduct(productId);

            if (existingProduct == null) {
                this.logger.warn("Product not found");
                return new HandlerResponse<>(null, List.of("Product not found"), false);
            }

            return new HandlerResponse<>(new ProductDTO(existingProduct), List.of("OK"), true);
        } catch (Error error) {
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));

            return new HandlerResponse<>(null, List.of("Unknown error"), false);
        }
    }

    public HandlerResponse<ProductDTO> createProduct(CreateProductRequest request) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            span.setTag("product.name", request.getName());
            span.setTag("product.price", request.getPrice());
            var validationResponse = request.validate();

            if (!validationResponse.isEmpty()) {
                return new HandlerResponse<>(null, validationResponse, false);
            }

            var product = Product.Create(request.getName(), request.getPrice());
            span.setTag("product.id", product.getProductId());

            this.repository.createProduct(product);

            this.eventPublisher.publishProductCreatedEvent(new ProductCreatedEvent(product.getProductId(), product.getName(), product.getPrice()));

            return new HandlerResponse<>(new ProductDTO(product), List.of("OK"), true);
        } catch (JsonProcessingException | Error error) {
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));

            return new HandlerResponse<>(null, List.of("Unknown error"), false);
        }
    }

    public HandlerResponse<ProductDTO> updateProduct(UpdateProductRequest request) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            span.setTag("product.id", request.getId());

            var validationResponse = request.validate();

            if (!validationResponse.isEmpty()) {
                return new HandlerResponse<>(null, validationResponse, false);
            }

            var existingProduct = this.repository.getProduct(request.getId());

            if (existingProduct == null) {
                return new HandlerResponse<>(null, List.of("Product not found"), false);
            }

            existingProduct.update(request.getName(), request.getPrice());

            if (!existingProduct.isUpdated()) {
                return new HandlerResponse<>(new ProductDTO(existingProduct), List.of("No updates required"), true);
            }

            this.repository.updateProduct(existingProduct);

            this.eventPublisher.publishProductUpdatedEvent(new ProductUpdatedEvent(existingProduct.getProductId(), new ProductDetails(existingProduct.getPreviousName(), existingProduct.getPreviousPrice()), new ProductDetails(existingProduct.getName(), existingProduct.getPrice())));

            return new HandlerResponse<>(new ProductDTO(existingProduct), List.of("OK"), true);
        } catch (JsonProcessingException | Error error) {
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));

            return new HandlerResponse<>(null, List.of("Unknown error"), false);
        }
    }

    public HandlerResponse<Boolean> deleteProduct(String productId) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            span.setTag("product.id", productId);
            var result = this.repository.deleteProduct(productId);

            if (result) {
                this.eventPublisher.publishProductDeletedEvent(new ProductDeletedEvent(productId));
            }

            return new HandlerResponse<>(true, List.of("OK"), true);
        } catch (Error error) {
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));

            return new HandlerResponse<>(null, List.of("Unknown error"), false);
        }
    }

    public HandlerResponse<Boolean> handleProductPriceCalculatedEvent(ProductPriceCalculatedEvent evt) {
        final Span span = GlobalTracer.get().activeSpan();
        try {
            span.setTag("product.id", evt.getProductId());
            Product existingProduct = this.repository.getProduct(evt.getProductId());

            if (existingProduct == null) {
                span.setTag("product.notFound", "true");
                span.setTag(Tags.ERROR, true);
                return new HandlerResponse<>(false, List.of("Product not found"), false);
            }
            
            span.setTag("product.priceBrackets", evt.getPriceBrackets().size());
            logger.info(String.format("Processing %s pricing brackets", evt.getPriceBrackets().size()));
            
            existingProduct.clearPricing();
            
            evt.getPriceBrackets().forEach((quantity, price) -> {
                logger.info(String.format("Adding price %s for quantity of %s", price, quantity));
                existingProduct.addPrice(new ProductPriceBracket(quantity, price));
            });
            
            this.repository.updateProduct(existingProduct);
            
            return new HandlerResponse<>(true, new ArrayList<>(), true);
        } catch (JsonProcessingException | Error error) {
            logger.error("An exception occurred!", error);
            span.setTag(Tags.ERROR, true);
            span.log(Collections.singletonMap(Fields.ERROR_OBJECT, error));

            return new HandlerResponse<>(null, List.of("Unknown error"), false);
        }
    }
}
