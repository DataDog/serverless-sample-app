// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text;
using Amazon.Lambda.SNSEvents;
using Datadog.Trace;

namespace TestHarness.Lambda;

public static class ObservabilityExtensions
{
    public static void AddToTelemetry(this SNSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        activeSpan?.SetTag("messaging.operation.type", "receive");
        activeSpan?.SetTag("messaging.system", "aws_sns");
        activeSpan?.SetTag("messaging.batch.message_count", evt.Records.Count);
    }

    public static void AddToTelemetry(this SNSEvent.SNSRecord record)
    {
        var processingSpan = Tracer.Instance.ActiveScope?.Span;
        processingSpan?.SetTag("messaging.message.body.size",
            Encoding.UTF8.GetByteCount(record.Sns.Message));
    }
}