// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.Core;

public interface IOrders
{
    Task<List<Order>> ForUser(string userId);
    
    Task<List<Order>> ConfirmedOrders();
    
    Task<Order?> WithOrderId(string userId, string orderNumber);

    Task Store(Order item);
}