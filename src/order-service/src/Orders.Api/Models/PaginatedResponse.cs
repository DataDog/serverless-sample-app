// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.Api.Models;

/// <summary>
/// Represents a paginated response with metadata
/// </summary>
/// <typeparam name="T">The type of items in the response</typeparam>
public class PaginatedResponse<T>
{
    /// <summary>
    /// Gets the items for the current page
    /// </summary>
    public IReadOnlyList<T> Items { get; }
    
    /// <summary>
    /// Gets the total number of items across all pages
    /// </summary>
    public int TotalCount { get; }
    
    /// <summary>
    /// Gets the current page number (1-based)
    /// </summary>
    public int PageNumber { get; }
    
    /// <summary>
    /// Gets the number of items per page
    /// </summary>
    public int PageSize { get; }
    
    /// <summary>
    /// Gets the total number of pages
    /// </summary>
    public int TotalPages { get; }
    
    /// <summary>
    /// Gets a value indicating whether there is a previous page
    /// </summary>
    public bool HasPreviousPage { get; }
    
    /// <summary>
    /// Gets a value indicating whether there is a next page
    /// </summary>
    public bool HasNextPage { get; }
    
    /// <summary>
    /// Gets the token to use for fetching the next page, if any
    /// </summary>
    public string? NextPageToken { get; }

    /// <summary>
    /// Creates a new PaginatedResponse with the given items and metadata
    /// </summary>
    /// <param name="items">The items for the current page</param>
    /// <param name="totalCount">The total number of items across all pages</param>
    /// <param name="pageNumber">The current page number (1-based)</param>
    /// <param name="pageSize">The number of items per page</param>
    /// <param name="nextPageToken">The token to use for fetching the next page, if any</param>
    public PaginatedResponse(IReadOnlyList<T> items, int totalCount, int pageNumber, int pageSize, string? nextPageToken = null)
    {
        Items = items;
        TotalCount = totalCount;
        PageNumber = pageNumber;
        PageSize = pageSize;
        NextPageToken = nextPageToken;
        
        TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        HasPreviousPage = pageNumber > 1;
        HasNextPage = pageNumber < TotalPages;
    }
    
    /// <summary>
    /// Creates a PaginatedResponse from a collection of items
    /// </summary>
    /// <param name="items">The items for the current page</param>
    /// <param name="pageNumber">The current page number (1-based)</param>
    /// <param name="pageSize">The number of items per page</param>
    /// <param name="nextPageToken">The token to use for fetching the next page, if any</param>
    /// <returns>A new PaginatedResponse with calculated metadata</returns>
    public static PaginatedResponse<T> Create(IReadOnlyList<T> items, int pageNumber, int pageSize, string? nextPageToken = null)
    {
        return new PaginatedResponse<T>(items, items.Count, pageNumber, pageSize, nextPageToken);
    }
} 