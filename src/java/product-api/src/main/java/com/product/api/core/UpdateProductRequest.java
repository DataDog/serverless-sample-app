package com.product.api.core;

import java.util.ArrayList;
import java.util.List;

public class UpdateProductRequest {
    private String id;
    private String name;
    private Double price;

    public Double getPrice() {
        return price;
    }

    public void setPrice(Double price) {
        this.price = price;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public List<String> validate() {
        List<String> validationResponse = new ArrayList<>();
        if (this.price <= 0) {
            validationResponse.add("Price must be greater than 0");
        }

        if (this.name == null || this.name.length() <= 3) {
            validationResponse.add("Name must be at least 3 characters");
        }

        return validationResponse;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }
}
