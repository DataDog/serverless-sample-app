package observability

import (
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

type ProductCreatedEvent struct {
	ProductId string `json:"productId"`
}

func TestExtrac(t *testing.T) {
	snsEntity := events.SNSEntity{
		Message: "{\"data\":{\"productId\":\"61b1258e-9952-43e0-b6c0-8e9ecb300c7e\"},\"_datadog\":{\"traceparent\":\"00-66fa8967000000006db552623d83a6f7-6db552623d83a6f7-01\",\"tracestate\":\"dd=s:1;p:6db552623d83a6f7;t.dm:-1;t.tid:66fa896700000000\",\"x-datadog-parent-id\":\"7905315302811084535\",\"x-datadog-sampling-priority\":\"1\",\"x-datadog-tags\":\"_dd.p.tid=66fa896700000000,_dd.p.dm=-1\",\"x-datadog-trace-id\":\"7905315302811084535\"}}",
	}

	data, spanLinks, err := ExtractContextFromSns[ProductCreatedEvent](snsEntity)

	if err != nil {
		t.Error("There should be no errors")
	}

	if len(spanLinks) != 1 {
		t.Error("Expected there to be 1 span link")
	}

	if data.ProductId != "61b1258e-9952-43e0-b6c0-8e9ecb300c7e" {
		t.Error("ProductID invalid")
	}
}
