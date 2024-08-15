package com.inventory.ordering.adapters;

import com.amazonaws.services.stepfunctions.AWSStepFunctions;
import com.amazonaws.services.stepfunctions.model.StartExecutionRequest;
import com.inventory.ordering.core.OrderingWorkflow;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class OrderingWorkflowImpl implements OrderingWorkflow {
    
    @Autowired
    AWSStepFunctions stepFunctionsClient;

    @Override
    public void startOrderingWorkflowFor(String productId) {
        this.stepFunctionsClient.startExecution(new StartExecutionRequest()
                .withStateMachineArn(System.getenv("STEP_FUNCTIONS_WORKFLOW_ARN"))
                .withInput(String.format("{\"productId\":\"%s\"}", productId)));
    }
}
