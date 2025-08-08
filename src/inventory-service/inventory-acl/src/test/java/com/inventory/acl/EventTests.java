/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.acl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.acl.adapters.EventBridgeMessageWrapper;
import com.inventory.acl.core.events.external.ProductCreatedEventV1;
import com.inventory.core.SpanLink;
import datadog.trace.api.DDTraceId;
import ddtrot.dd.trace.bootstrap.instrumentation.api.AgentSpanLink;
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

        TypeReference<EventBridgeMessageWrapper<ProductCreatedEventV1>> typeRef = new TypeReference<>(){};

        EventBridgeMessageWrapper<ProductCreatedEventV1> evtWrapper = objectMapper.readValue(eventSample, typeRef);
        
        var productId = evtWrapper.getDetail().getData().getProductId();
        assertEquals("1235", productId);
    }

    @Test
    public void spanLinkTest() {
        var spanLink = new SpanLink(DDTraceId.from("1980053316360325065"), 443086618547378631L, AgentSpanLink.SAMPLED_FLAG, null, null);

        assertEquals("1980053316360325065", spanLink.traceId().toString());
    }
}
