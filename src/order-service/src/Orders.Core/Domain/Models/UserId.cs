// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json.Serialization;

namespace Orders.Core.Domain.Models;

/// <summary>
/// Value object representing a user identifier
/// </summary>
public record UserId
{
    /// <summary>
    /// The string value of the user ID
    /// </summary>
    public string Value { get; }

    /// <summary>
    /// Creates a new UserId with the given value
    /// </summary>
    /// <param name="value">The string value for the user ID</param>
    /// <exception cref="ArgumentException">Thrown when the value is null or empty</exception>
    [JsonConstructor]
    public UserId(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException("User ID cannot be null or empty", nameof(value));
        }
        
        Value = value;
    }

    /// <summary>
    /// Implicitly converts a UserId to its string representation
    /// </summary>
    public static implicit operator string(UserId userId) => userId.Value;

    /// <summary>
    /// Explicitly converts a string to a UserId
    /// </summary>
    public static explicit operator UserId(string value) => new(value);

    /// <summary>
    /// Returns the string representation of the UserId
    /// </summary>
    public override string ToString() => Value;
} 