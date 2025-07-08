// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.Api.Models;

/// <summary>
/// Standard error response model for API errors
/// </summary>
public record ErrorResponse(
    string Error,
    string Message,
    string? Details = null,
    Dictionary<string, string[]>? ValidationErrors = null,
    string? CorrelationId = null);

/// <summary>
/// Validation-specific error response model
/// </summary>
public record ValidationErrorResponse(
    string Error,
    Dictionary<string, string[]> ValidationErrors,
    string? CorrelationId = null);

/// <summary>
/// Error codes used throughout the API
/// </summary>
public static class ErrorCodes
{
    public const string ValidationError = "VALIDATION_ERROR";
    public const string InvalidState = "INVALID_STATE";
    public const string NotFound = "NOT_FOUND";
    public const string Unauthorized = "UNAUTHORIZED";
    public const string Forbidden = "FORBIDDEN";
    public const string InternalError = "INTERNAL_ERROR";
    public const string ServiceUnavailable = "SERVICE_UNAVAILABLE";
}