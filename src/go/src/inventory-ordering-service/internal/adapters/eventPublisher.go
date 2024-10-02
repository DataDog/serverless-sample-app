//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package adapters

import (
	"context"
	"encoding/json"
	"log"
	"os"

	"github.com/aws/aws-sdk-go-v2/service/sfn"
	"go.opentelemetry.io/otel/propagation"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type TracedMessage[T any] struct {
	Data    T                      `json:"data"`
	Datadog propagation.MapCarrier `json:"_datadog"`
}

type StepFunctionsWorkflowInput struct {
	ProductId string `json:"productId"`
}

type StepFunctionsWorkflowEngine struct {
	client sfn.Client
}

func NewStepFunctionsWorkflowEngine(client sfn.Client) *StepFunctionsWorkflowEngine {
	return &StepFunctionsWorkflowEngine{client: client}
}

func (publisher StepFunctionsWorkflowEngine) StartOrderingWorkflowFor(ctx context.Context, productId string) {
	span, _ := tracer.SpanFromContext(ctx)

	carrier := propagation.MapCarrier{}
	tracer.Inject(span.Context(), carrier)

	tracedInput := TracedMessage[StepFunctionsWorkflowInput]{
		Data:    StepFunctionsWorkflowInput{ProductId: productId},
		Datadog: carrier,
	}

	tracedMessageData, _ := json.Marshal(tracedInput)
	message := string(tracedMessageData)
	workflowArn := os.Getenv("ORDERING_SERVICE_WORKFLOW_ARN")

	input := &sfn.StartExecutionInput{
		Input:           &message,
		StateMachineArn: &workflowArn,
	}

	_, err := publisher.client.StartExecution(ctx, input)

	if err != nil {
		log.Fatalf("Failure starting workflow, error: %s", err)
	}
}
