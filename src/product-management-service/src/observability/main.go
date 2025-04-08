package observability

import (
	"context"
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
	span, _ := tracer.SpanFromContext(ctx)

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
