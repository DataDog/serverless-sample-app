// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Orders.Core.Common;

namespace Orders.Core;

/// <summary>
/// Repository interface for order data access operations
/// </summary>
public interface IOrders
{
    /// <summary>
    /// Gets orders for a specific user with pagination
    /// </summary>
    /// <param name="userId">The user ID to get orders for</param>
    /// <param name="pagination">Pagination parameters</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Paginated list of orders for the user</returns>
    Task<PagedResult<Order>> ForUser(string userId, PaginationRequest pagination, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Gets all confirmed orders with pagination
    /// </summary>
    /// <param name="pagination">Pagination parameters</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Paginated list of confirmed orders</returns>
    Task<PagedResult<Order>> ConfirmedOrders(PaginationRequest pagination, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Gets a specific order by user ID and order ID
    /// </summary>
    /// <param name="userId">The user ID that owns the order</param>
    /// <param name="orderNumber">The order number/ID</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>The order if found, null otherwise</returns>
    Task<Order?> WithOrderId(string userId, string orderNumber, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stores a single order
    /// </summary>
    /// <param name="item">The order to store</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task Store(Order item, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Stores multiple orders in a batch operation
    /// </summary>
    /// <param name="orders">The orders to store</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task StoreBatch(IEnumerable<Order> orders, CancellationToken cancellationToken = default);
}