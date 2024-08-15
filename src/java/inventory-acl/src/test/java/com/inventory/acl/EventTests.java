package com.inventory.acl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.acl.adapters.EventBridgeMessageWrapper;
import com.inventory.acl.core.events.external.ProductCreatedEventV1;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class EventTests {
    @Test
    public void testInputEventSerialization() throws JsonProcessingException, IOException {
        var objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        var eventSample = Files.readString(Path.of("src/test/data/sample-event.json"), Charset.defaultCharset());

        TypeReference<EventBridgeMessageWrapper<ProductCreatedEventV1>> typeRef = new TypeReference<EventBridgeMessageWrapper<ProductCreatedEventV1>>(){};

        EventBridgeMessageWrapper<ProductCreatedEventV1> evtWrapper = objectMapper.readValue(eventSample, typeRef);
        
        var productId = evtWrapper.getDetail().getProductId();
        assertEquals("1235", productId);
    }
}
