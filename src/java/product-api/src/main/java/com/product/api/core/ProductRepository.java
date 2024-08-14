package com.product.api.core;

import com.fasterxml.jackson.core.JsonProcessingException;

public interface ProductRepository {
    Product getProduct(String productId);
    Product createProduct(Product product) throws JsonProcessingException;
    Product updateProduct(Product product) throws JsonProcessingException;
    boolean deleteProduct(String productId);
}
