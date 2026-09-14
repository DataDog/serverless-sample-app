// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

package observability

import (
	"context"
	"encoding/json"
	"testing"
)

type testPayload struct {
	Value string `json:"value"`
}

// TestCloudEvent_TraceparentPresent verifies that traceparent is present at the
// top level of the CloudEvent for distributed trace context propagation.
func TestCloudEvent_TraceparentPresent(t *testing.T) {
	evt := NewCloudEvent(context.Background(), "test.event.v1", testPayload{Value: "test"})

	data, err := json.Marshal(evt)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if _, ok := result["traceparent"]; !ok {
		t.Fatal("expected 'traceparent' at top level of CloudEvent")
	}
}

// TestCloudEvent_StandardFieldsPresent verifies that all required CloudEvents 1.0
// fields are present in the serialized output.
func TestCloudEvent_StandardFieldsPresent(t *testing.T) {
	evt := NewCloudEvent(context.Background(), "test.event.v1", testPayload{Value: "hello"})

	data, err := json.Marshal(evt)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	required := []string{"specversion", "id", "type", "source", "time", "data", "traceparent"}
	for _, field := range required {
		if _, ok := result[field]; !ok {
			t.Errorf("expected required field '%s' in CloudEvent JSON", field)
		}
	}
	if result["specversion"] != "1.0" {
		t.Errorf("expected specversion='1.0', got %v", result["specversion"])
	}
}
