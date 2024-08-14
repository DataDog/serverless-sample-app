package com.product.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.api.core.ProductCreatedEvent;
import com.product.api.core.ProductPriceBracket;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class EventTests {
    @Test
    public void testInputEventSerialization() throws JsonProcessingException, IOException {
        var objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        var eventSample = Files.readString(Path.of("src/test/data/sample-event.json"), Charset.defaultCharset());

        TypeReference<EventBridgeMessageWrapper<ProductCreatedEvent>> typeRef = new TypeReference<EventBridgeMessageWrapper<ProductCreatedEvent>>(){};

        EventBridgeMessageWrapper<ProductCreatedEvent> evtWrapper = objectMapper.readValue(eventSample, typeRef);
        
        var productId = evtWrapper.getDetail().getProductId();
        assertEquals("1235", productId);
    }
    
    @Test
    public void testPriceBracketDeserialization() throws JsonProcessingException, IOException {
        var objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        var eventSample = Files.readString(Path.of("src/test/data/sample.json"), Charset.defaultCharset());

        List<ProductPriceBracket> brackets = objectMapper.readValue(eventSample, new TypeReference<List<ProductPriceBracket>>(){});

        assertEquals(5, brackets.size());
    }
}
