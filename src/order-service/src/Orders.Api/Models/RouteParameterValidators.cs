// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using FluentValidation;

namespace Orders.Api.Models;

/// <summary>
/// Request model for route parameters that need validation
/// </summary>
public record GetOrderRequest
{
    /// <summary>
    /// Gets or sets the order ID from the route
    /// </summary>
    public string OrderId { get; set; } = "";
    
    /// <summary>
    /// Gets or sets the user ID (from claims, but validated)
    /// </summary>
    public string? UserId { get; set; }
}

/// <summary>
/// Validator for GetOrderRequest route parameters
/// </summary>
public class GetOrderRequestValidator : AbstractValidator<GetOrderRequest>
{
    /// <summary>
    /// Initializes a new instance of the validator with validation rules
    /// </summary>
    public GetOrderRequestValidator()
    {
        RuleFor(x => x.OrderId)
            .NotEmpty().WithMessage("Order ID is required")
            .Length(1, 100).WithMessage("Order ID must be between 1 and 100 characters")
            .Matches(@"^[a-zA-Z0-9\-_]+$").WithMessage("Order ID contains invalid characters");

        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("User ID is required")
            .Length(1, 100).WithMessage("User ID must be between 1 and 100 characters")
            .Matches(@"^[a-zA-Z0-9\-_@.]+$").WithMessage("User ID contains invalid characters")
            .When(x => !string.IsNullOrEmpty(x.UserId));
    }
}

/// <summary>
/// Request model for pagination query parameters
/// </summary>
public record PaginationQueryRequest
{
    /// <summary>
    /// Gets or sets the page size
    /// </summary>
    public int PageSize { get; set; } = 20;
    
    /// <summary>
    /// Gets or sets the page token for continuation
    /// </summary>
    public string? PageToken { get; set; }
}

/// <summary>
/// Validator for pagination query parameters
/// </summary>
public class PaginationQueryRequestValidator : AbstractValidator<PaginationQueryRequest>
{
    /// <summary>
    /// Initializes a new instance of the validator with validation rules
    /// </summary>
    public PaginationQueryRequestValidator()
    {
        RuleFor(x => x.PageSize)
            .GreaterThan(0).WithMessage("Page size must be greater than 0")
            .LessThanOrEqualTo(100).WithMessage("Page size cannot exceed 100");

        RuleFor(x => x.PageToken)
            .Length(1, 1000).WithMessage("Page token must be between 1 and 1000 characters")
            .Must(BeValidBase64Token).WithMessage("Page token format is invalid")
            .When(x => !string.IsNullOrEmpty(x.PageToken));
    }

    /// <summary>
    /// Validates that a string is a valid base64 encoded token
    /// </summary>
    private static bool BeValidBase64Token(string? token)
    {
        if (string.IsNullOrEmpty(token))
            return true;

        try
        {
            Convert.FromBase64String(token);
            return true;
        }
        catch
        {
            return false;
        }
    }
}