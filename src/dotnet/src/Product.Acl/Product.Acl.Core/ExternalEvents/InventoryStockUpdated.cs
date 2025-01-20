// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace Product.Acl.Core.ExternalEvents;

public record InventoryStockUpdated
{
    public string ProductId { get; set; }
    public int PreviousStockLevel { get; set; }
    public int NewStockLevel { get; set; }
}