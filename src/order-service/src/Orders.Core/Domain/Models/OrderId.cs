// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json.Serialization;

namespace Orders.Core.Domain.Models;

/// <summary>
/// Value object representing an order identifier
/// </summary>
public record OrderId
{
    /// <summary>
    /// The string value of the order ID
    /// </summary>
    public string Value { get; }

    /// <summary>
    /// Creates a new OrderId with the given value
    /// </summary>
    /// <param name="value">The string value for the order ID</param>
    /// <exception cref="ArgumentException">Thrown when the value is null or empty</exception>
    [JsonConstructor]
    public OrderId(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("Order ID cannot be null or empty", nameof(value));
        }
        
        Value = value;
    }

    /// <summary>
    /// Creates a new random OrderId
    /// </summary>
    /// <returns>A new OrderId with a random GUID value</returns>
    public static OrderId CreateNew() => new(Guid.NewGuid().ToString());

    /// <summary>
    /// Implicitly converts an OrderId to its string representation
    /// </summary>
    public static implicit operator string(OrderId orderId) => orderId.Value;

    /// <summary>
    /// Explicitly converts a string to an OrderId
    /// </summary>
    public static explicit operator OrderId(string value) => new(value);

    /// <summary>
    /// Returns the string representation of the OrderId
    /// </summary>
    public override string ToString() => Value;
} 