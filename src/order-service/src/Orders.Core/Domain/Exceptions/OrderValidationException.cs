// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.Core.Domain.Exceptions;

/// <summary>
/// Exception thrown when order validation fails
/// </summary>
public class OrderValidationException : Exception
{
    public Dictionary<string, string[]> ValidationErrors { get; }

    public OrderValidationException(string message) : base(message)
    {
        ValidationErrors = new Dictionary<string, string[]>();
    }

    public OrderValidationException(string message, Dictionary<string, string[]> validationErrors) : base(message)
    {
        ValidationErrors = validationErrors;
    }

    public OrderValidationException(string message, Exception innerException) : base(message, innerException)
    {
        ValidationErrors = new Dictionary<string, string[]>();
    }
}