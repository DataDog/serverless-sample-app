// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json.Serialization;
using Orders.Core.Adapters;
using Orders.Core.Domain.Exceptions;

namespace Orders.Core.Domain.Models;

/// <summary>
/// Represents the status of an order
/// </summary>
public enum OrderStatus
{
    /// <summary>
    /// Order has been created but not yet confirmed
    /// </summary>
    Created,
    
    /// <summary>
    /// Order has been confirmed
    /// </summary>
    Confirmed,
    
    /// <summary>
    /// Order has been completed
    /// </summary>
    Completed,
    
    /// <summary>
    /// Order cannot be fulfilled due to stock unavailability
    /// </summary>
    NoStock
}

/// <summary>
/// Represents the type of an order
/// </summary>
public enum OrderType
{
    /// <summary>
    /// Standard order with normal processing
    /// </summary>
    Standard,
    
    /// <summary>
    /// Priority order with expedited processing
    /// </summary>
    Priority
}

/// <summary>
/// Represents an order in the system
/// </summary>
public class Order
{
    /// <summary>
    /// Gets the unique identifier for this order
    /// </summary>
    public OrderId OrderId { get; private set; }

    /// <summary>
    /// Gets the user identifier that placed this order
    /// </summary>
    public UserId UserId { get; private set; }
    
    /// <summary>
    /// Gets the list of product identifiers in this order
    /// </summary>
    public IReadOnlyList<string> Products { get; private set; }
    
    /// <summary>
    /// Gets the date when the order was created
    /// </summary>
    public DateTime OrderDate { get; private set; }
    
    /// <summary>
    /// Gets the type of the order (Standard or Priority)
    /// </summary>
    public OrderType OrderType { get; private set; }
    
    /// <summary>
    /// Gets the current status of the order
    /// </summary>
    public OrderStatus OrderStatus { get; private set; }
    
    /// <summary>
    /// Gets the total price of the order
    /// </summary>
    public decimal TotalPrice { get; private set; }

    /// <summary>
    /// Creates a new order with the specified properties
    /// </summary>
    private Order(OrderId orderId, UserId userId, IReadOnlyList<string> products, DateTime orderDate, OrderType orderType, OrderStatus orderStatus, decimal totalPrice)
    {
        OrderId = orderId;
        UserId = userId;
        Products = products;
        OrderDate = orderDate;
        OrderType = orderType;
        OrderStatus = orderStatus;
        TotalPrice = totalPrice;
    }
    
    /// <summary>
    /// Creates a new standard order for the specified user with the given products
    /// </summary>
    /// <param name="userId">The user placing the order</param>
    /// <param name="products">The products being ordered</param>
    /// <returns>A new standard order</returns>
    public static Order CreateStandard(UserId userId, IEnumerable<string> products)
    {
        var orderId = OrderId.CreateNew();
        var productsList = products.ToList().AsReadOnly();
        
        orderId.ToString().AddToTelemetry("order.id");
        
        return new Order(
            orderId, 
            userId, 
            productsList, 
            DateTime.UtcNow, 
            OrderType.Standard, 
            OrderStatus.Created, 
            0);
    }
    
    /// <summary>
    /// Creates a new priority order for the specified user with the given products
    /// </summary>
    /// <param name="userId">The user placing the order</param>
    /// <param name="products">The products being ordered</param>
    /// <returns>A new priority order</returns>
    public static Order CreatePriority(UserId userId, IEnumerable<string> products)
    {
        var orderId = OrderId.CreateNew();
        var productsList = products.ToList().AsReadOnly();
        
        orderId.ToString().AddToTelemetry("order.id");
        
        return new Order(
            orderId, 
            userId, 
            productsList, 
            DateTime.UtcNow, 
            OrderType.Priority, 
            OrderStatus.Created, 
            0);
    }
    
    /// <summary>
    /// Factory method to create an order from existing data
    /// </summary>
    public static Order Reconstitute(
        string orderId, 
        string userId, 
        IEnumerable<string> products, 
        DateTime orderDate, 
        OrderType orderType, 
        OrderStatus orderStatus, 
        decimal totalPrice)
    {
        return new Order(
            new OrderId(orderId),
            new UserId(userId),
            products.ToList().AsReadOnly(),
            orderDate,
            orderType,
            orderStatus,
            totalPrice);
    }

    /// <summary>
    /// Marks the order as failed due to stock unavailability
    /// </summary>
    public void MarkStockReservationFailed()
    {
        OrderStatus = OrderStatus.NoStock;
    }
    
    /// <summary>
    /// Confirms the order
    /// </summary>
    /// <exception cref="InvalidOrderStateException">Thrown when trying to confirm an order that is not in Created status</exception>
    public void Confirm()
    {
        if (OrderStatus != OrderStatus.Created)
        {
            throw new InvalidOrderStateException($"Cannot confirm order in status: {OrderStatus}. Order must be in Created status.");
        }

        OrderStatus = OrderStatus.Confirmed;
    }

    /// <summary>
    /// Completes the order
    /// </summary>
    /// <exception cref="OrderNotConfirmedException">Thrown when trying to complete an order that is not in Confirmed status</exception>
    public void Complete()
    {
        if (OrderStatus != OrderStatus.Confirmed)
        {
            throw new OrderNotConfirmedException();
        }
        
        OrderStatus = OrderStatus.Completed;
    }
    
    /// <summary>
    /// Sets the total price of the order
    /// </summary>
    /// <param name="price">The price to set</param>
    /// <exception cref="ArgumentException">Thrown if the price is negative</exception>
    public void SetPrice(decimal price)
    {
        if (price < 0)
        {
            throw new ArgumentException("Price cannot be negative", nameof(price));
        }
        
        TotalPrice = price;
    }
    
    /// <summary>
    /// Compatibility property to get the order number as a string
    /// </summary>
    /// <remarks>
    /// This is provided for backward compatibility with existing code
    /// New code should use OrderId.Value directly
    /// </remarks>
    [JsonIgnore]
    public string OrderNumber => OrderId.Value;
} 