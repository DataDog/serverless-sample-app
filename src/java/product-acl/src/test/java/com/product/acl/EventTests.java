/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.product.acl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.acl.adapters.EventBridgeMessageWrapper;
import com.product.acl.core.events.external.InventoryStockUpdatedEventV1;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class EventTests {
    @Test
    public void testInputEventSerialization() throws IOException {
        var objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

        var eventSample = Files.readString(Path.of("src/test/data/sample-event.json"), Charset.defaultCharset());

        TypeReference<EventBridgeMessageWrapper<InventoryStockUpdatedEventV1>> typeRef = new TypeReference<>(){};

        EventBridgeMessageWrapper<InventoryStockUpdatedEventV1> evtWrapper = objectMapper.readValue(eventSample, typeRef);
        
        var productId = evtWrapper.getDetail().getProductId();
        assertEquals("1235", productId);

        var previousStockLevel = evtWrapper.getDetail().getPreviousStockLevel();
        assertEquals(99, previousStockLevel);

        var newStockLevel = evtWrapper.getDetail().getNewStockLevel();
        assertEquals(12, newStockLevel);
    }
}
