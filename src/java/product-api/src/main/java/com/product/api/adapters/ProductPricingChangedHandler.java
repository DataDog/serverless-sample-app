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
