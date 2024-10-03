/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.core;

import com.fasterxml.jackson.core.JsonProcessingException;

import java.util.List;

public interface ProductRepository {
    List<Product> listProducts();
    Product getProduct(String productId);
    Product createProduct(Product product) throws JsonProcessingException;
    Product updateProduct(Product product) throws JsonProcessingException;
    boolean deleteProduct(String productId);
}
