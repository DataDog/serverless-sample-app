package observability

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"go.opentelemetry.io/otel/propagation"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type CloudEvent[T any] struct {
	Data        T                      `json:"data"`
	Datadog     propagation.MapCarrier `json:"_datadog"`
	SpecVersion string                 `json:"specversion"`
	Type        string                 `json:"type"`
	Source      string                 `json:"source"`
	Id          string                 `json:"id"`
	Time        string                 `json:"time"`
	TraceParent string                 `json:"traceparent"`
}

type InboundTracedMessage[T any] struct {
	Data    T                 `json:"data"`
	Datadog map[string]string `json:"_datadog"`
}

func NewCloudEvent[T any](ctx context.Context, evtType string, data T) CloudEvent[T] {
	span, _ := tracer.SpanFromContext(ctx)

	carrier := propagation.MapCarrier{}
	tracer.Inject(span.Context(), carrier)

	return CloudEvent[T]{
		SpecVersion: "1.0",
		Type:        evtType,
		Source:      fmt.Sprintf("%s.products", os.Getenv("ENV")),
		Id:          uuid.New().String(),
		Time:        time.Now().Format(time.RFC3339),
		TraceParent: carrier.Get("traceparent"),
		Data:        data,
		Datadog:     carrier,
	}
}

func ExtractContextFromSns[T any](snsMessage events.SNSEntity) (T, []ddtrace.SpanLink, error) {
	fmt.Println("SNS Message body is" + snsMessage.Message)

	var evt InboundTracedMessage[T]
	json.Unmarshal([]byte(snsMessage.Message), &evt)

	fmt.Println("Unmarshalled event body, keys are:")
	for index := range evt.Datadog {
		fmt.Println(evt.Datadog[index])
	}
	fmt.Println("------")

	sctx, err := tracer.Extract(evt.Datadog)

	if err != nil {
		fmt.Println(err.Error())

		return evt.Data, nil, err
	}

	spanLinks := []ddtrace.SpanLink{
		{
			TraceID: sctx.TraceID(),
			SpanID:  sctx.SpanID(),
		},
	}

	return evt.Data, spanLinks, nil
}
