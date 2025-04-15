// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.Core.Domain.Exceptions;

/// <summary>
/// Exception thrown when an operation requiring a confirmed order is attempted on an order that is not confirmed
/// </summary>
public class OrderNotConfirmedException : InvalidOrderStateException
{
    /// <summary>
    /// Initializes a new instance of the <see cref="OrderNotConfirmedException"/> class
    /// </summary>
    public OrderNotConfirmedException() 
        : base("The order must be confirmed before this operation can be performed.")
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="OrderNotConfirmedException"/> class with a specified error message
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    public OrderNotConfirmedException(string message) : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="OrderNotConfirmedException"/> class with a specified error message
    /// and a reference to the inner exception that is the cause of this exception.
    /// </summary>
    /// <param name="message">The message that describes the error</param>
    /// <param name="innerException">The exception that caused the current exception</param>
    public OrderNotConfirmedException(string message, Exception innerException) : base(message, innerException)
    {
    }
} 