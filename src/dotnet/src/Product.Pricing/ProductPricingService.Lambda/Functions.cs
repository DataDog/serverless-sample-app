// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.SNSEvents;
using Datadog.Trace;
using ProductPricingService.Core;

namespace ProductPricingService.Lambda;

public class Functions(PricingService pricingService)
{
    [LambdaFunction]
    public async Task HandleProductCreated(SNSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();

        foreach (var record in evt.Records)
        {
            var processingSpan = Tracer.Instance.StartActive("process", new SpanCreationSettings()
            {
                Parent = activeSpan?.Context
            });
            record.AddToTelemetry();
            
            try
            {
                using var timer = record.StartProcessingTimer();

                var evtData = JsonSerializer.Deserialize<ProductCreatedEvent>(record.Sns.Message);

                if (evtData is null)
                    throw new ArgumentException("Event payload does not serialize to a `ProductCreatedEvent`");

                await pricingService.GeneratePricingFor(evtData.ProductId, new ProductPrice(evtData.Price));

                processingSpan.Close();
                record.AddProcessingMetrics();
            }
            catch (Exception e)
            {
                processingSpan.Span?.SetTag("error.type", e.GetType().Name);
                record.AddProcessingMetrics(e);
                throw;
            }
            finally
            {
                processingSpan.Close();
            }
        }
    }

    [LambdaFunction]
    public async Task HandleProductUpdated(SNSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();

        foreach (var record in evt.Records)
        {
            var processingSpan = Tracer.Instance.StartActive("process", new SpanCreationSettings()
            {
                Parent = activeSpan?.Context
            });
            try
            {
                record.AddToTelemetry();

                using var timer = record.StartProcessingTimer();

                var evtData = JsonSerializer.Deserialize<ProductUpdatedEvent>(record.Sns.Message);

                if (evtData is null)
                    throw new ArgumentException("Event payload does not serialize to a `ProductUpdatedEvent`");

                await pricingService.GeneratePricingFor(evtData.ProductId, new ProductPrice(evtData.Updated.Price));

                record.AddProcessingMetrics();
            }
            catch (Exception e)
            {
                processingSpan.Span?.SetTag("error.type", e.GetType().Name);
                record.AddProcessingMetrics(e);
                throw;
            }
            finally
            {
                processingSpan.Close();
            }
        }
    }

}