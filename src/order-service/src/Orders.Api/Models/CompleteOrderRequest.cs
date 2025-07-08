// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json.Serialization;
using FluentValidation;

namespace Orders.Api.Models;

/// <summary>
/// Request model for completing an order
/// </summary>
public record CompleteOrderRequest
{
    /// <summary>
    /// Gets or sets the order ID to complete
    /// </summary>
    [JsonPropertyName("orderId")]
    public string OrderId { get; set; } = "";
    
    /// <summary>
    /// Gets or sets the user ID that owns the order
    /// </summary>
    [JsonPropertyName("userId")]
    public string UserId { get; set; } = "";
}

/// <summary>
/// Validator for the CompleteOrderRequest
/// </summary>
public class CompleteOrderRequestValidator : AbstractValidator<CompleteOrderRequest>
{
    /// <summary>
    /// Initializes a new instance of the validator with validation rules
    /// </summary>
    public CompleteOrderRequestValidator()
    {
        RuleFor(x => x.OrderId)
            .NotEmpty().WithMessage("Order ID is required")
            .Length(1, 100).WithMessage("Order ID must be between 1 and 100 characters")
            .Matches(@"^[a-zA-Z0-9\-_]+$").WithMessage("Order ID contains invalid characters");

        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("User ID is required")
            .Length(1, 100).WithMessage("User ID must be between 1 and 100 characters")
            .Matches(@"^[a-zA-Z0-9\-_@.]+$").WithMessage("User ID contains invalid characters");
    }
}