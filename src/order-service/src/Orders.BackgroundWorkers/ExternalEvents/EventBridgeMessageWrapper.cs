// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json.Serialization;

namespace Orders.BackgroundWorkers.ExternalEvents;

public record EventBridgeMessageWrapper<T> where T : class
{
    [JsonPropertyName("detail")]
    public T? Detail { get; set; } = default;

    [JsonPropertyName("detail-type")]
    public string DetailType { get; set; } = "";

    [JsonPropertyName("source")]
    public string Source { get; set; } = "";
}