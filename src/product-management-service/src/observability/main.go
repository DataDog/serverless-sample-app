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
	Data        T                 `json:"data"`
	SpecVersion string            `json:"specversion"`
	Type        string            `json:"type"`
	Source      string            `json:"source"`
	Id          string            `json:"id"`
	Time        string            `json:"time"`
	TraceParent string            `json:"traceparent"`
	extensions  map[string]string `json:"-"` // Custom properties not directly serialized
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
		extensions:  make(map[string]string),
	}
}

func (ce CloudEvent[T]) ToJSON() ([]byte, error) {
	// Create a map with all standard fields
	allFields := map[string]interface{}{
		"data":        ce.Data,
		"specversion": ce.SpecVersion,
		"type":        ce.Type,
		"source":      ce.Source,
		"id":          ce.Id,
		"time":        ce.Time,
		"traceparent": ce.TraceParent,
	}

	// Add all extension fields at the top level
	for k, v := range ce.extensions {
		allFields[k] = v
	}

	return json.Marshal(allFields)
}

func (evt CloudEvent[T]) Set(key string, val string) {
	if evt.extensions == nil {
		evt.extensions = make(map[string]string)
	}
	evt.extensions[key] = val
}

func (evt CloudEvent[T]) ForeachKey(handler func(key string, val string) error) error {
	for key, val := range evt.extensions {
		if err := handler(key, val); err != nil {
			return err
		}
	}
	return nil
}
