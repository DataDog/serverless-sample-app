// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json.Serialization;

namespace Product.Acl.Core.InternalEvents;

public record ProductStockUpdated
{
    [JsonPropertyName("productId")] public string ProductId { get; set; } = "";

    [JsonPropertyName("stockLevel")] public int StockLevel { get; set; }
}