// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace ProductApi.Core;

public record ProductDeletedEvent
{
    public ProductDeletedEvent(string productId)
    {
        this.ProductId = productId;
    }
    
    public string ProductId { get; set; }
}