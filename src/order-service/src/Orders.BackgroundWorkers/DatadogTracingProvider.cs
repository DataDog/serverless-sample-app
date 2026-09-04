// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json;
using Datadog.Trace;

namespace Orders.BackgroundWorkers;

public class DatadogTracingProvider : ITracingProvider
{
    public ISpan? GetActiveSpan() => Tracer.Instance.ActiveScope?.Span;

    public ISpanContext? ExtractContext(
        JsonDocument carrier,
        Func<JsonDocument, string, IEnumerable<string?>> getter)
    {
        return new SpanContextExtractor().Extract(carrier, getter);
    }

    public IScope StartActiveSpan(string operationName, ISpanContext? parentContext)
    {
        return Tracer.Instance.StartActive(operationName, new SpanCreationSettings
        {
            Parent = parentContext
        });
    }
}
