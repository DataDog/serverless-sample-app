// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace ProductApi.Core;

public record ProductCreatedEvent
{
    public ProductCreatedEvent(Product product)
    {
        this.ProductId = product.ProductId;
        this.Name = product.Details.Name;
        this.Price = product.Details.Price;
    }
    
    public string ProductId { get; set; }

    public string Name { get; set; }

    public decimal Price { get; set; }
}