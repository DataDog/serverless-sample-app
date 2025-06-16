// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json.Serialization;

namespace Orders.BackgroundWorkers.ExternalEvents;

public class EventWrapper<T>
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";

    [JsonPropertyName("type")] public string Type { get; set; } = "";

    [JsonPropertyName("traceparent")] public string TraceParent { get; set; } = "";

    [JsonPropertyName("data")] public T? Data { get; set; }
}