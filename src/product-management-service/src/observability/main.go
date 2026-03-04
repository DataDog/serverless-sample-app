package observability

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"

	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

// CloudEvent is a CloudEvents 1.0 envelope. The _datadog field holds the Datadog
// DSM carrier context (dd-pathway-ctx-base64) and traceparent, matching the nested
// _datadog object format used by the Java, .NET, and TypeScript services.
type CloudEvent[T any] struct {
	Data        T                 `json:"data"`
	SpecVersion string            `json:"specversion"`
	Type        string            `json:"type"`
	Source      string            `json:"source"`
	Id          string            `json:"id"`
	Time        string            `json:"time"`
	TraceParent string            `json:"traceparent"`
	Datadog     map[string]string `json:"_datadog,omitempty"`
}

func NewCloudEvent[T any](ctx context.Context, evtType string, data T) CloudEvent[T] {
	span, spanWasFound := tracer.SpanFromContext(ctx)

	var traceParent string
	if !spanWasFound || span == nil {
		fmt.Println("NewCloudEvent: No span found in current context")
	} else {
		spanCtx := span.Context()
		spanID := spanCtx.SpanID()
		// Use the full 128-bit trace ID when available (W3C traceparent requires 32 hex chars).
		// SpanContextW3C.TraceID128() returns the hex-encoded 128-bit trace ID already padded to 32 chars.
		var traceID string
		if w3cCtx, ok := spanCtx.(ddtrace.SpanContextW3C); ok {
			traceID = w3cCtx.TraceID128()
		} else {
			traceID = fmt.Sprintf("%032x", spanCtx.TraceID())
		}
		traceParent = fmt.Sprintf("00-%s-%016x-01", traceID, spanID)
	}

	return CloudEvent[T]{
		SpecVersion: "1.0",
		Type:        evtType,
		Source:      fmt.Sprintf("%s.products", os.Getenv("ENV")),
		Id:          uuid.New().String(),
		Time:        time.Now().Format(time.RFC3339),
		TraceParent: traceParent,
		Data:        data,
		Datadog:     make(map[string]string),
	}
}

func (ce CloudEvent[T]) ToJSON() ([]byte, error) {
	return json.Marshal(ce)
}

// Set implements the datastreams TextMapWriter interface.
// Uses a pointer receiver so that DSM can inject keys into the DataDog map
// on the actual CloudEvent value, not a copy.
func (evt *CloudEvent[T]) Set(key string, val string) {
	if evt.Datadog == nil {
		evt.Datadog = make(map[string]string)
	}
	evt.Datadog[key] = val
}

// ForeachKey implements the datastreams TextMapReader interface.
// Uses a pointer receiver for consistency with Set.
func (evt *CloudEvent[T]) ForeachKey(handler func(key string, val string) error) error {
	for key, val := range evt.Datadog {
		if err := handler(key, val); err != nil {
			return err
		}
	}
	return nil
}
