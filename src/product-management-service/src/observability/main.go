package observability

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
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
// Uses a pointer receiver so that DSM can inject keys into the Datadog map
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

type TransactionEvent struct {
	TransactionID  string `json:"transaction_id"`  // unique identifier for this transaction
	Checkpoint     string `json:"checkpoint"`      // name of the pipeline stage
	TimestampNanos string `json:"timestamp_nanos"` // wall-clock time in nanoseconds (as a string)
}

// Payload is the top-level request body sent to the pipeline_stats endpoint.
type Payload struct {
	Transactions []TransactionEvent `json:"transactions"`
	Service      string             `json:"service"`     // name of the reporting service
	Environment  string             `json:"environment"` // deployment environment (e.g. "prod", "local")
}

// getEnv returns the value of an environment variable, or a fallback if unset.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func TrackTransaction(ctx context.Context, transactionEvent TransactionEvent) error {
	span, _ := tracer.SpanFromContext(ctx)
	span.SetTag("dsm.transaction_id", transactionEvent.TransactionID)
	span.SetTag("dsm.transaction.checkpoint", transactionEvent.Checkpoint)

	ddSite := getEnv("DD_SITE", "us3.datadoghq.com")

	// The pipeline_stats endpoint on the Datadog trace-agent ingestion host.
	// Construct the URL dynamically so it targets the correct Datadog site.
	pipelineStatsURL := fmt.Sprintf("https://trace.agent.%s/api/v0.1/pipeline_stats", ddSite)

	payload := Payload{
		Transactions: []TransactionEvent{transactionEvent},
		Service:      getEnv("DD_SERVICE", "rms"),
		Environment:  getEnv("DD_ENV", "local"),
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}

	// Write the JSON into a gzip stream backed by an in-memory buffer.
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	if _, err := w.Write(jsonPayload); err != nil {
		panic(err)
	}
	w.Close() // flush and write gzip footer — must be called before reading buf
	gzipPayload := buf.Bytes()

	// -----------------------------------------------------------------------
	// Send the HTTP POST request
	// -----------------------------------------------------------------------

	req, err := http.NewRequest(http.MethodPost, pipelineStatsURL, bytes.NewReader(gzipPayload))
	if err != nil {
		panic(err)
	}
	req.Header.Set("Content-Type", "application/json")     // body is JSON before compression
	req.Header.Set("Content-Encoding", "gzip")             // body is gzip-compressed
	req.Header.Set("DD-API-KEY", getEnv("DD_API_KEY", "")) // authentication header
	req.Header.Set("Content-Length", strconv.Itoa(len(gzipPayload)))

	// A successful submission returns HTTP 202 Accepted.
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	span.SetTag("tt.status", resp.StatusCode)

	return nil
}
