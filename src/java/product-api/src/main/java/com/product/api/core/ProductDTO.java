package com.product.api.core;

import java.util.List;

public class ProductDTO {
    private String productId;
    private String name;
    private Double price;
    private List<ProductPriceBracket> priceBrackets;

    public ProductDTO(Product product) {
        this.productId = product.getProductId();
        this.name = product.getName();
        this.price = product.getPrice();
        this.priceBrackets = product.getPriceBrackets();
    }

    public List<ProductPriceBracket> getPriceBrackets() {
        return priceBrackets;
    }

    public Double getPrice() {
        return price;
    }

    public String getName() {
        return name;
    }

    public String getProductId() {
        return productId;
    }
}
