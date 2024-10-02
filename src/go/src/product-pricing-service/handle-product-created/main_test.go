//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

package main

import (
	"context"
	"product-pricing-service/internal/core"
	"testing"

	"github.com/aws/aws-lambda-go/events"
)

type SpyEventPublisher struct {
	Calls               int
	GeneratedBreakdowns int
	HasZeroPrice        bool
}

func (spy *SpyEventPublisher) PublishPriceCalculated(ctx context.Context, evt core.PriceCalculatedEvent) {
	spy.Calls++

	spy.GeneratedBreakdowns = len(evt.PriceBrackets)

	for index := range evt.PriceBrackets {
		price := evt.PriceBrackets[index].Price

		if price <= 0 {
			spy.HasZeroPrice = true
		}
	}
}

type ProductCreatedEvent struct {
	ProductId string `json:"productId"`
}

func Test_WhenEventPayloadIsValid_ShouldGeneratePricing(t *testing.T) {
	spyEventPublisher := &SpyEventPublisher{}

	eventHandler := core.NewProductCreatedEventHandler(spyEventPublisher, core.PricingService{})

	lambdaHandler := NewLambdaHandler(*eventHandler)

	snsEvent := events.SNSEvent{}
	snsEvent.Records = append(snsEvent.Records, events.SNSEventRecord{
		SNS: events.SNSEntity{
			Message: "{\"data\":{\"productId\":\"61b1258e-9952-43e0-b6c0-8e9ecb300c7e\", \"price\": 12.99},\"_datadog\":{\"traceparent\":\"00-66fa8967000000006db552623d83a6f7-6db552623d83a6f7-01\",\"tracestate\":\"dd=s:1;p:6db552623d83a6f7;t.dm:-1;t.tid:66fa896700000000\",\"x-datadog-parent-id\":\"7905315302811084535\",\"x-datadog-sampling-priority\":\"1\",\"x-datadog-tags\":\"_dd.p.tid=66fa896700000000,_dd.p.dm=-1\",\"x-datadog-trace-id\":\"7905315302811084535\"}}",
		},
	})

	lambdaHandler.Handle(context.Background(), snsEvent)

	if spyEventPublisher.Calls != 1 {
		t.Error("Event publisher should be called once")
	}

	if spyEventPublisher.GeneratedBreakdowns != 5 {
		t.Error("Price breakdowns not generated")
	}

	if spyEventPublisher.HasZeroPrice {
		t.Error("At least one 0 value price has been generated")
	}
}

func Test_WhenEventPayloadIsMissingPrice_ShouldNotPublishEvent(t *testing.T) {
	spyEventPublisher := &SpyEventPublisher{}

	eventHandler := core.NewProductCreatedEventHandler(spyEventPublisher, core.PricingService{})

	lambdaHandler := NewLambdaHandler(*eventHandler)

	snsEvent := events.SNSEvent{}
	snsEvent.Records = append(snsEvent.Records, events.SNSEventRecord{
		SNS: events.SNSEntity{
			Message: "{\"data\":{\"productId\":\"61b1258e-9952-43e0-b6c0-8e9ecb300c7e\"},\"_datadog\":{\"traceparent\":\"00-66fa8967000000006db552623d83a6f7-6db552623d83a6f7-01\",\"tracestate\":\"dd=s:1;p:6db552623d83a6f7;t.dm:-1;t.tid:66fa896700000000\",\"x-datadog-parent-id\":\"7905315302811084535\",\"x-datadog-sampling-priority\":\"1\",\"x-datadog-tags\":\"_dd.p.tid=66fa896700000000,_dd.p.dm=-1\",\"x-datadog-trace-id\":\"7905315302811084535\"}}",
		},
	})

	lambdaHandler.Handle(context.Background(), snsEvent)

	if spyEventPublisher.Calls > 0 {
		t.Error("Event publisher should not be called")
	}
}

func Test_WhenEventPayloadIsMissingProductId_ShouldNotPublishEvent(t *testing.T) {
	spyEventPublisher := &SpyEventPublisher{}

	eventHandler := core.NewProductCreatedEventHandler(spyEventPublisher, core.PricingService{})

	lambdaHandler := NewLambdaHandler(*eventHandler)

	snsEvent := events.SNSEvent{}
	snsEvent.Records = append(snsEvent.Records, events.SNSEventRecord{
		SNS: events.SNSEntity{
			Message: "{\"data\":{\"productId\":\"\", \"price\": 12.99},\"_datadog\":{\"traceparent\":\"00-66fa8967000000006db552623d83a6f7-6db552623d83a6f7-01\",\"tracestate\":\"dd=s:1;p:6db552623d83a6f7;t.dm:-1;t.tid:66fa896700000000\",\"x-datadog-parent-id\":\"7905315302811084535\",\"x-datadog-sampling-priority\":\"1\",\"x-datadog-tags\":\"_dd.p.tid=66fa896700000000,_dd.p.dm=-1\",\"x-datadog-trace-id\":\"7905315302811084535\"}}",
		},
	})

	lambdaHandler.Handle(context.Background(), snsEvent)

	if spyEventPublisher.Calls > 0 {
		t.Error("Event publisher should not be called")
	}
}
