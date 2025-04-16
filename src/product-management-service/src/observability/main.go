package observability

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"

	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type CloudEvent[T any] struct {
	Data        T      `json:"data"`
	SpecVersion string `json:"specversion"`
	Type        string `json:"type"`
	Source      string `json:"source"`
	Id          string `json:"id"`
	Time        string `json:"time"`
	TraceParent string `json:"traceparent"`
}

func NewCloudEvent[T any](ctx context.Context, evtType string, data T) CloudEvent[T] {
	span, spanWasFound := tracer.SpanFromContext(ctx)

	if !spanWasFound {
		fmt.Println("NewCloudEvent: No span found in current context")
	}

	return CloudEvent[T]{
		SpecVersion: "1.0",
		Type:        evtType,
		Source:      fmt.Sprintf("%s.products", os.Getenv("ENV")),
		Id:          uuid.New().String(),
		Time:        time.Now().Format(time.RFC3339),
		TraceParent: fmt.Sprintf("00-%016x-%016x-01", span.Context().TraceID(), span.Context().SpanID()),
		Data:        data,
	}
}

func (ce CloudEvent[T]) ToJSON() ([]byte, error) {
	b, err := json.Marshal(ce)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal CloudEvent: %w", err)
	}
	return b, nil
}
