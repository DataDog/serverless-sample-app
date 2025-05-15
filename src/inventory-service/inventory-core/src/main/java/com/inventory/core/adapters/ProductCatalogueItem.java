package com.inventory.core.adapters;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductCatalogueItem {
    private String productId;

    // Default constructor for deserialization
    public ProductCatalogueItem() {
    }

    // Getters and setters
    public String getProductId() {
        return productId;
    }
}
