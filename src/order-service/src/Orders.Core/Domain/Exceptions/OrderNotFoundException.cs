// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Orders.Core.Domain.Models;

namespace Orders.Core.Domain.Exceptions;

/// <summary>
/// Exception thrown when an order cannot be found
/// </summary>
public class OrderNotFoundException : Exception
{
    public OrderId OrderId { get; }
    public UserId UserId { get; }

    public OrderNotFoundException(OrderId orderId, UserId userId) 
        : base($"Order with ID '{orderId.Value}' not found for user '{userId.Value}'")
    {
        OrderId = orderId;
        UserId = userId;
    }

    public OrderNotFoundException(OrderId orderId, UserId userId, Exception innerException) 
        : base($"Order with ID '{orderId.Value}' not found for user '{userId.Value}'", innerException)
    {
        OrderId = orderId;
        UserId = userId;
    }
}