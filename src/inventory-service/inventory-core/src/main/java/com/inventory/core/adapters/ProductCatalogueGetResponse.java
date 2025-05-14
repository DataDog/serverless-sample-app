package com.inventory.core.adapters;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.ArrayList;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductCatalogueGetResponse {
    ArrayList<ProductCatalogueItem> data;

    public ArrayList<ProductCatalogueItem> getData() {
        return data;
    }
}
