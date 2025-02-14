// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace ProductApi.Core;

public interface IProducts
{
    Task<List<Product>> All();
    
    Task<Product?> WithId(string productId);
    
    Task RemoveWithId(string productId);

    Task AddNew(Product product);
    
    Task UpdateExistingFrom(Product product);
}