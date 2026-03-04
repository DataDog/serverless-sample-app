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

// TestCloudEvent_DatadogIsNestedObject verifies that the _datadog field is serialized
// as a nested JSON object (matching the format used by Java, .NET, and TypeScript services),
// not as top-level extension keys.
func TestCloudEvent_DatadogIsNestedObject(t *testing.T) {
	evt := NewCloudEvent(context.Background(), "test.event.v1", testPayload{Value: "test"})

	data, err := json.Marshal(evt)
	if err != nil {
		t.Fatalf("failed to marshal CloudEvent: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal JSON: %v", err)
	}

	datadogRaw, ok := result["_datadog"]
	if !ok {
		t.Fatal("expected '_datadog' field in JSON output, got none")
	}
	_, isMap := datadogRaw.(map[string]interface{})
	if !isMap {
		t.Fatalf("expected '_datadog' to be a JSON object, got %T", datadogRaw)
	}
}

// TestCloudEvent_SetWritesIntoDatadogMap verifies that Set() (the DSM carrier method)
// writes into the _datadog nested object rather than as a top-level key.
func TestCloudEvent_SetWritesIntoDatadogMap(t *testing.T) {
	evt := NewCloudEvent(context.Background(), "test.event.v1", testPayload{Value: "test"})
	evt.Set("dd-pathway-ctx-base64", "abc123")

	data, err := json.Marshal(evt)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	// Must be inside _datadog, not at top level
	if _, topLevel := result["dd-pathway-ctx-base64"]; topLevel {
		t.Fatal("dd-pathway-ctx-base64 must NOT appear as a top-level field")
	}

	datadogRaw, ok := result["_datadog"]
	if !ok {
		t.Fatal("expected '_datadog' field")
	}
	datadog, ok := datadogRaw.(map[string]interface{})
	if !ok {
		t.Fatalf("expected '_datadog' to be an object, got %T", datadogRaw)
	}
	val, ok := datadog["dd-pathway-ctx-base64"]
	if !ok {
		t.Fatal("expected 'dd-pathway-ctx-base64' inside '_datadog'")
	}
	if val != "abc123" {
		t.Fatalf("expected 'abc123', got %v", val)
	}
}

// TestCloudEvent_ForeachKeyReadsFromDatadogMap verifies that ForeachKey() (the DSM
// carrier extraction method) iterates over keys in the _datadog map.
func TestCloudEvent_ForeachKeyReadsFromDatadogMap(t *testing.T) {
	evt := NewCloudEvent(context.Background(), "test.event.v1", testPayload{Value: "test"})
	evt.Set("key1", "val1")
	evt.Set("key2", "val2")

	found := make(map[string]string)
	err := evt.ForeachKey(func(key, val string) error {
		found[key] = val
		return nil
	})
	if err != nil {
		t.Fatalf("ForeachKey returned error: %v", err)
	}

	if found["key1"] != "val1" {
		t.Errorf("expected key1=val1, got key1=%v", found["key1"])
	}
	if found["key2"] != "val2" {
		t.Errorf("expected key2=val2, got key2=%v", found["key2"])
	}
}

// TestCloudEvent_TraceparentInDatadogForCrossServiceCompat verifies that traceparent
// is present both at the top level (for Go consumers using span links) AND inside
// _datadog (for Java/.NET/TypeScript consumers that read traceparent from _datadog).
func TestCloudEvent_TraceparentInDatadogForCrossServiceCompat(t *testing.T) {
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

	datadogRaw, ok := result["_datadog"]
	if !ok {
		t.Fatal("expected '_datadog' field")
	}
	datadog, ok := datadogRaw.(map[string]interface{})
	if !ok {
		t.Fatalf("expected '_datadog' to be an object")
	}
	if _, ok := datadog["traceparent"]; !ok {
		t.Fatal("expected 'traceparent' inside '_datadog' for Java/.NET/TypeScript consumer compatibility")
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
