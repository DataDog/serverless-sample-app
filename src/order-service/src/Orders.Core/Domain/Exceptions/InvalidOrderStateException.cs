// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.Core.Domain.Exceptions;

/// <summary>
/// Exception thrown when an operation is attempted on an order in an invalid state
/// </summary>
public class InvalidOrderStateException : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="InvalidOrderStateException"/> class
    /// </summary>
    public InvalidOrderStateException() : base("The order is in an invalid state for the requested operation.")
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="InvalidOrderStateException"/> class with a specified error message
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    public InvalidOrderStateException(string message) : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="InvalidOrderStateException"/> class with a specified error message
    /// and a reference to the inner exception that is the cause of this exception.
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    /// <param name="innerException">The exception that caused the current exception</param>
    public InvalidOrderStateException(string message, Exception innerException) : base(message, innerException)
    {
    }
} 