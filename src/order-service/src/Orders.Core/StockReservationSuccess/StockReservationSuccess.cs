// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json.Serialization;

namespace Orders.Core.StockReservationSuccess;

public class StockReservationSuccess
{
    public string UserId { get; set; } = "";

    public string OrderNumber { get; set; } = "";

    [JsonPropertyName("_datadog")]
    public Dictionary<string, string>? Datadog { get; set; }
}