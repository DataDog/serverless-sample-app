package utils

import "gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"

type TracedMessage[T any] struct {
	Data    T                     `json:"data"`
	Datadog tracer.TextMapCarrier `json:"_datadog"`
}
