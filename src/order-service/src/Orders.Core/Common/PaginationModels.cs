// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.Core.Common;

/// <summary>
/// Represents a request for paginated data
/// </summary>
public record PaginationRequest(
    int PageSize = 20,
    string? PageToken = null)
{
    /// <summary>
    /// Validates the pagination request parameters
    /// </summary>
    public bool IsValid => PageSize > 0 && PageSize <= 100;
}

/// <summary>
/// Represents a paginated result set
/// </summary>
/// <typeparam name="T">The type of items in the result set</typeparam>
public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int PageSize,
    string? NextPageToken,
    bool HasMorePages)
{
    /// <summary>
    /// Gets the number of items in the current page
    /// </summary>
    public int ItemCount => Items.Count;

    /// <summary>
    /// Creates an empty paged result
    /// </summary>
    public static PagedResult<T> Empty(int pageSize) => 
        new(Array.Empty<T>(), pageSize, null, false);

    /// <summary>
    /// Creates a paged result for a single page with no more data
    /// </summary>
    public static PagedResult<T> SinglePage(IReadOnlyList<T> items, int pageSize) =>
        new(items, pageSize, null, false);

    /// <summary>
    /// Creates a paged result with a continuation token for more data
    /// </summary>
    public static PagedResult<T> WithNextPage(IReadOnlyList<T> items, int pageSize, string nextPageToken) =>
        new(items, pageSize, nextPageToken, true);
}