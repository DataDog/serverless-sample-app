// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace ProductApi.Core;

public record ProductUpdatedEvent
{
    public ProductUpdatedEvent(Product product)
    {
        this.ProductId = product.ProductId;
        this.Previous = product.PreviousDetails;
        this.Updated = product.Details;
    }
    
    public string ProductId { get; set; }

    public ProductDetails? Previous { get; set; }

    public ProductDetails Updated { get; set; }
}