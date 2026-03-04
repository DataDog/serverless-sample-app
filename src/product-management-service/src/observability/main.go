package observability

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"

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

	if !spanWasFound {
		fmt.Println("NewCloudEvent: No span found in current context")
	}

	traceparent := fmt.Sprintf("00-%016x-%016x-01", span.Context().TraceID(), span.Context().SpanID())

	return CloudEvent[T]{
		SpecVersion: "1.0",
		Type:        evtType,
		Source:      fmt.Sprintf("%s.products", os.Getenv("ENV")),
		Id:          uuid.New().String(),
		Time:        time.Now().Format(time.RFC3339),
		TraceParent: traceparent,
		Data:        data,
		// Pre-populate _datadog with traceparent so Java/.NET/TypeScript consumers
		// that read traceparent from _datadog (not the top-level field) work correctly.
		Datadog: map[string]string{
			"traceparent": traceparent,
		},
	}
}

// Set implements the datastreams.Carrier interface. Writes into the _datadog map
// so that DSM context (dd-pathway-ctx-base64) is serialized as a nested object
// matching the format used by all other services in this system.
func (ce CloudEvent[T]) Set(key string, val string) {
	if ce.Datadog == nil {
		ce.Datadog = make(map[string]string)
	}
	ce.Datadog[key] = val
}

// ForeachKey implements the datastreams.Carrier interface. Reads from the _datadog
// map so that DSM context injected by any service (Java, .NET, TypeScript, Go) can
// be extracted correctly.
func (ce CloudEvent[T]) ForeachKey(handler func(key string, val string) error) error {
	for key, val := range ce.Datadog {
		if err := handler(key, val); err != nil {
			return err
		}
	}
	return nil
}
