/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.inventory.ordering.adapters;

import com.inventory.ordering.core.OrderingWorkflow;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.sfn.SfnClient;
import software.amazon.awssdk.services.sfn.model.StartExecutionRequest;

@Component
public class OrderingWorkflowImpl implements OrderingWorkflow {
    
    @Autowired
    SfnClient stepFunctionsClient;

    @Override
    public void startOrderingWorkflowFor(String productId) {
        this.stepFunctionsClient.startExecution(StartExecutionRequest.builder()
                .stateMachineArn(System.getenv("ORDERING_SERVICE_WORKFLOW_ARN"))
                .input(String.format("{\"productId\":\"%s\"}", productId))
                .build());
    }
}
