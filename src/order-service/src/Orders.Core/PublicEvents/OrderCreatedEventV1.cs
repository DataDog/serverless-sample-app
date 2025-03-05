// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json.Serialization;

namespace Orders.Core.PublicEvents;

public record OrderCreatedEventV1
{
    [JsonPropertyName("orderNumber")]
    public string OrderNumber { get; set; } = "";

    [JsonPropertyName("userId")]
    public string UserId { get; set; } = "";

    [JsonPropertyName("products")]
    public string[] Products { get; set; } = [];
}