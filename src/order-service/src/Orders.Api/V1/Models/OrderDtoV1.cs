// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Orders.Core;

namespace Orders.Api.V1.Models;

/// <summary>
/// Version 1 of the Order DTO - maintains backward compatibility
/// </summary>
public record OrderDtoV1(
    string OrderId,
    string UserId,
    IReadOnlyList<string> Products,
    DateTime OrderDate,
    string OrderType,
    string OrderStatus,
    decimal TotalPrice)
{
    /// <summary>
    /// Creates a V1 DTO from a domain Order object
    /// </summary>
    public static OrderDtoV1 FromOrder(Order order)
    {
        return new OrderDtoV1(
            order.OrderNumber,
            order.UserId,
            order.Products,
            order.OrderDate,
            order.OrderType.ToString(),
            order.OrderStatus.ToString(),
            order.TotalPrice
        );
    }
}

/// <summary>
/// Version 1 paginated response format
/// </summary>
/// <typeparam name="T">The type of items in the response</typeparam>
public record PaginatedResponseV1<T>(
    IReadOnlyList<T> Data,
    int PageSize,
    bool HasMorePages,
    string? NextPageToken)
{
    /// <summary>
    /// Gets the total number of items in the current page
    /// </summary>
    public int Count => Data.Count;
}

/// <summary>
/// Version 1 API response envelope for consistent error handling
/// </summary>
public record ApiResponseV1<T>(
    T? Data,
    bool Success,
    string? Error = null,
    string? CorrelationId = null,
    int? ErrorCode = null)
{
    /// <summary>
    /// Creates a successful response
    /// </summary>
    public static ApiResponseV1<T> Ok(T data, string? correlationId = null) =>
        new(data, true, null, correlationId, null);

    /// <summary>
    /// Creates an error response
    /// </summary>
    public static ApiResponseV1<T> Failure(string error, string? correlationId = null, int? errorCode = null) =>
        new(default, false, error, correlationId, errorCode);
}