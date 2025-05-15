package com.inventory.core;

import com.inventory.core.adapters.ProductCatalogueItem;

import java.util.ArrayList;

public interface ProductService {
    ArrayList<ProductCatalogueItem> getProductCatalogue();
}
