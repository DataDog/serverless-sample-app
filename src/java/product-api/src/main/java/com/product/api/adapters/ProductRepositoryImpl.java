package com.product.api.adapters;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.model.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.api.core.Product;
import com.product.api.core.ProductPriceBracket;
import com.product.api.core.ProductRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public class ProductRepositoryImpl implements ProductRepository {
    private final AmazonDynamoDB dynamoDB;
    private final ObjectMapper mapper;
    private final Logger logger = LoggerFactory.getLogger(ProductRepositoryImpl.class);
    private static final String PARTITION_KEY = "PK";
    private static final String PRODUCT_ID_KEY = "ProductId";
    private static final String NAME_KEY = "Name";
    private static final String PRICE_KEY = "Price";
    private static final String TYPE_KEY = "Type";
    private static final String PRICE_BRACKET_KEY = "PriceBrackets";

    public ProductRepositoryImpl(AmazonDynamoDB dynamoDB, ObjectMapper mapper) {
        this.dynamoDB = dynamoDB;
        this.mapper = mapper;
    }

    @Override
    public Product getProduct(String productId) {
        GetItemRequest request = new GetItemRequest()
                .withTableName(System.getenv("TABLE_NAME"))
                .addKeyEntry(PARTITION_KEY, new AttributeValue(productId));

        GetItemResult result = dynamoDB.getItem(request);

        Map<String, AttributeValue> item = result.getItem();

        if (item == null) {
            return null;
        }

        try {
            String priceBracketString = item.get(PRICE_BRACKET_KEY).getS();
            
            logger.info(priceBracketString);
            
            List<ProductPriceBracket> brackets = this.mapper.readValue(priceBracketString, new TypeReference<>() {});

            return new Product(item.get(PARTITION_KEY).getS(), item.get(NAME_KEY).getS(), Double.parseDouble(item.get(PRICE_KEY).getN()), brackets);
        }
        catch (JsonProcessingException error){
            logger.error("An exception occurred!", error);
            return new Product(item.get(PARTITION_KEY).getS(), item.get(NAME_KEY).getS(), Double.parseDouble(item.get(PRICE_KEY).getN()), List.of());
        }
    }

    @Override
    public Product createProduct(Product product) throws JsonProcessingException {
        HashMap<String, AttributeValue> item =
                new HashMap<>();
        item.put(PARTITION_KEY, new AttributeValue(product.getProductId()));
        item.put(TYPE_KEY, new AttributeValue("Product"));
        item.put(PRODUCT_ID_KEY, new AttributeValue(product.getProductId()));
        item.put(NAME_KEY, new AttributeValue(product.getName()));
        item.put(PRICE_KEY, new AttributeValue().withN(product.getPrice().toString()));
        item.put(PRICE_BRACKET_KEY, new AttributeValue(this.mapper.writeValueAsString(product.getPriceBrackets())));

        PutItemRequest putItemRequest = new PutItemRequest()
                .withTableName(System.getenv("TABLE_NAME"))
                .withItem(item);

        this.dynamoDB.putItem(putItemRequest);
        
        return product;
    }

    @Override
    public Product updateProduct(Product product) throws JsonProcessingException {
        HashMap<String, AttributeValue> item =
                new HashMap<>();
        item.put(PARTITION_KEY, new AttributeValue(product.getProductId()));
        item.put(TYPE_KEY, new AttributeValue("Product"));
        item.put(PRODUCT_ID_KEY, new AttributeValue(product.getProductId()));
        item.put(NAME_KEY, new AttributeValue(product.getName()));
        item.put(PRICE_KEY, new AttributeValue().withN(product.getPrice().toString()));
        item.put(PRICE_BRACKET_KEY, new AttributeValue(this.mapper.writeValueAsString(product.getPriceBrackets())));

        PutItemRequest putItemRequest = new PutItemRequest()
                .withTableName(System.getenv("TABLE_NAME"))
                .withItem(item);

        this.dynamoDB.putItem(putItemRequest);

        return product;
    }

    @Override
    public boolean deleteProduct(String productId) {
        try{
            DeleteItemRequest deleteItemRequest = new DeleteItemRequest()
                    .withTableName(System.getenv("TABLE_NAME"))
                    .withConditionExpression("attribute_exists(ProductId)")
                    .addKeyEntry(PARTITION_KEY, new AttributeValue(productId));

            var deleteResult = this.dynamoDB.deleteItem(deleteItemRequest);
            
            return true;
        }
        catch (ConditionalCheckFailedException error) {
            this.logger.warn("Attempted to delete a product that does not exist");
            
            return false;
        }
    }
}
