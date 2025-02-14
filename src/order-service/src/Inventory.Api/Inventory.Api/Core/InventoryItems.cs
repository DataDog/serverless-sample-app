// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Inventory.Api.Core;

public interface InventoryItems
{
    Task<InventoryItem?> WithProductId(string productId);

    Task Update(InventoryItem item);
}