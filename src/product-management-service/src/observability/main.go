package observability

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-lambda-go/events"
	"go.opentelemetry.io/otel/propagation"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace"
	"gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"
)

type TracedMessage[T any] struct {
	Data    T                      `json:"data"`
	Datadog propagation.MapCarrier `json:"_datadog"`
}

type InboundTracedMessage[T any] struct {
	Data    T                 `json:"data"`
	Datadog map[string]string `json:"_datadog"`
}

func NewTracedMessage[T any](ctx context.Context, data T) TracedMessage[T] {
	span, _ := tracer.SpanFromContext(ctx)

	carrier := propagation.MapCarrier{}
	tracer.Inject(span.Context(), carrier)

	return TracedMessage[T]{
		Data:    data,
		Datadog: carrier,
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
