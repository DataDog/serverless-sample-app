/*
 * Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2024 Datadog, Inc.
 */

package com.cdk.inventory.ordering;

import com.cdk.constructs.InstrumentedFunction;
import com.cdk.constructs.InstrumentedFunctionProps;
import org.jetbrains.annotations.NotNull;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.Tags;
import software.amazon.awscdk.services.lambda.IFunction;
import software.amazon.awscdk.services.lambda.eventsources.SnsEventSource;
import software.amazon.awscdk.services.lambda.eventsources.SnsEventSourceProps;
import software.amazon.awscdk.services.logs.LogGroup;
import software.amazon.awscdk.services.logs.LogGroupProps;
import software.amazon.awscdk.services.sqs.Queue;
import software.amazon.awscdk.services.sqs.QueueProps;
import software.amazon.awscdk.services.ssm.StringParameter;
import software.amazon.awscdk.services.ssm.StringParameterProps;
import software.amazon.awscdk.services.stepfunctions.*;
import software.constructs.Construct;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;

public class InventoryOrderingService extends Construct {
    public InventoryOrderingService(@NotNull Construct scope, @NotNull String id, @NotNull InventoryOrderingServiceProps props) {
        super(scope, id);

        LogGroup workflowLogGroup = new LogGroup(this, "InventoryOrderingWorkflowLogGroup", LogGroupProps.builder()
                .logGroupName(String.format("/aws/vendedlogs/states/InventoryOrderingWorkflowLogGroup-%s", props.sharedProps().env()))
                .removalPolicy(RemovalPolicy.DESTROY)
                .build());

        String workflowFilePath = "../cdk/src/main/java/com/cdk/inventory/ordering/workflows/workflow.setStock.asl.json";

        StateMachine workflow = new StateMachine(this, "InventoryOrderingWorkflow", StateMachineProps.builder()
                .stateMachineName(String.format("InventoryOrderingService-%s", props.sharedProps().env()))
                .definitionBody(DefinitionBody.fromFile(workflowFilePath))
                .definitionSubstitutions(new HashMap<>() {{
                    put("TableName", props.table().getTableName());
                }})
                .logs(LogOptions.builder()
                        .destination(workflowLogGroup)
                        .includeExecutionData(true)
                        .level(LogLevel.ALL)
                        .build())
                .build());

        props.table().grantReadWriteData(workflow.getRole());

        Tags.of(workflow).add("DD_ENHANCED_METRICS", "true");
        Tags.of(workflow).add("DD_TRACE_ENABLED", "true");

        HashMap<String, String> functionEnvVars = new HashMap<>(2);
        functionEnvVars.put("ORDERING_SERVICE_WORKFLOW_ARN", workflow.getStateMachineArn());

        String compiledJarFilePath = "../inventory-ordering-service/target/com.inventory.ordering-1.0.0-SNAPSHOT-aws.jar";
        IFunction handleProductAddedFunction = new InstrumentedFunction(this, "ProductAddedFunction",
                new InstrumentedFunctionProps(props.sharedProps(), "com.inventory.ordering", compiledJarFilePath, "handleNewProductAdded", functionEnvVars)).getFunction();
        workflow.grantStartExecution(handleProductAddedFunction);

        handleProductAddedFunction.addEventSource(new SnsEventSource(props.newProductAddedTopic(), SnsEventSourceProps.builder()
                .deadLetterQueue(new Queue(this, "NewProductAddedEventSourceDLQ", QueueProps.builder()
                        .queueName(String.format("NewProductAddedEventSourceDLQ-%s", props.sharedProps().env()))
                        .build()))
                .build()));
        
    }
}
