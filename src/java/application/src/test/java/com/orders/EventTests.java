package com.orders;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.orders.application.EventBridgeMessageWrapper;
import com.orders.application.FunctionConfiguration;
import com.orders.application.core.OrderConfirmedEvent;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;

public class EventTests {
    @Test
    public void testInputEventSerialization() throws JsonProcessingException, IOException {
        var objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        var eventSample = Files.readString(Path.of("src/test/data/sample-event.json"), Charset.defaultCharset());

        TypeReference<EventBridgeMessageWrapper<OrderConfirmedEvent>> typeRef = new TypeReference<EventBridgeMessageWrapper<OrderConfirmedEvent>>(){};

        EventBridgeMessageWrapper<OrderConfirmedEvent> evtWrapper = objectMapper.readValue(eventSample, typeRef);
        
        var orderId = evtWrapper.getDetail().getOrderId();
        
    }
}
