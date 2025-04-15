// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using FluentValidation;

namespace Orders.Api.Models;

/// <summary>
/// Request model for creating a new order
/// </summary>
public class CreateOrderRequest
{
    /// <summary>
    /// Gets or sets the list of product identifiers to order
    /// </summary>
    public string[] Products { get; set; } = Array.Empty<string>();
}

/// <summary>
/// Validator for the CreateOrderRequest
/// </summary>
public class CreateOrderRequestValidator : AbstractValidator<CreateOrderRequest>
{
    /// <summary>
    /// Initializes a new instance of the validator with validation rules
    /// </summary>
    public CreateOrderRequestValidator()
    {
        RuleFor(x => x.Products)
            .NotEmpty().WithMessage("Products cannot be empty")
            .Must(p => p.Length <= 100).WithMessage("Too many products in a single order");

        RuleForEach(x => x.Products)
            .NotEmpty().WithMessage("Product ID cannot be empty")
            .Length(1, 50).WithMessage("Product ID must be between 1 and 50 characters");
    }
} 