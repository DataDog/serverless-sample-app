/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.ordering.adapters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.inventory.ordering.core.OrderingWorkflow;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.sfn.SfnClient;
import software.amazon.awssdk.services.sfn.model.StartExecutionRequest;

import java.util.Map;

@Component
public class OrderingWorkflowImpl implements OrderingWorkflow {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    SfnClient stepFunctionsClient;

    @Override
    public void startOrderingWorkflowFor(String productId) {
        this.stepFunctionsClient.startExecution(StartExecutionRequest.builder()
                .stateMachineArn(System.getenv("ORDERING_SERVICE_WORKFLOW_ARN"))
                .input(buildWorkflowInput(productId))
                .build());
    }

    private static String buildWorkflowInput(String productId) {
        try {
            // Serialize with Jackson so productId values containing quotes,
            // backslashes or other control characters cannot break out of the
            // JSON structure (JSON injection).
            return OBJECT_MAPPER.writeValueAsString(Map.of("productId", productId));
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Failed to serialize ordering workflow input", e);
        }
    }
}
