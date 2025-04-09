package observability

import (
	"context"
	"encoding/json"
	"fmt"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace"
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

func (ce CloudEvent[T]) ToJSON() ([]byte, error) {
	b, err := json.Marshal(ce)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal CloudEvent: %w", err)
	}
	return b, nil
}

func (ce CloudEvent[T]) ExtractSpanLinks() []ddtrace.SpanLink {
	links := []ddtrace.SpanLink{}

	if ce.TraceParent != "" {
		fmt.Println("Trace parent found:", ce.TraceParent)
		// Extract trace ID and span ID from the traceparent header
		var traceID, spanID uint64
		_, err := fmt.Sscanf(ce.TraceParent, "00-%016x-%016x-01", &traceID, &spanID)
		if err != nil {
			fmt.Printf("failed to parse traceparent header: %v", err)
			return links
		}

		fmt.Println("Successfully parsed 'traceparent' from CloudEvent. TraceID:", traceID, "SpanID:", spanID)
		// Create a span link using the extracted trace ID and span ID
		spanLink := ddtrace.SpanLink{
			TraceID: traceID,
			SpanID:  spanID,
		}

		links = append(links, spanLink)
	}

	fmt.Println("Returning span links:", len(links))

	return links
}
