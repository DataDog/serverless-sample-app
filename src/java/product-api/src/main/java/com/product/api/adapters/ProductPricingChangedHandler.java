/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.api.adapters;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.api.core.ProductService;

import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;

public class ProductPricingChangedHandler {
    @Autowired
    Logger logger;
    
    @Autowired
    ProductService service;
    
    @Autowired
    ObjectMapper mapper;
    
    
}
