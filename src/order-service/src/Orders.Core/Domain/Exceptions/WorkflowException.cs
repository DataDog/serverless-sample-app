// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Orders.Core.Domain.Models;

namespace Orders.Core.Domain.Exceptions;

/// <summary>
/// Exception thrown when workflow operations fail
/// </summary>
public class WorkflowException : Exception
{
    public OrderId OrderId { get; }

    public WorkflowException(OrderId orderId, string message) : base(message)
    {
        OrderId = orderId;
    }

    public WorkflowException(OrderId orderId, string message, Exception innerException) : base(message, innerException)
    {
        OrderId = orderId;
    }
}