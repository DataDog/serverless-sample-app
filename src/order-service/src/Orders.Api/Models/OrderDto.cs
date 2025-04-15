// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json.Serialization;
using Orders.Core.Domain.Models;

namespace Orders.Api.Models;

/// <summary>
/// Data Transfer Object for representing an Order in API responses
/// </summary>
public class OrderDto
{
    /// <summary>
    /// Gets the unique identifier for this order
    /// </summary>
    public string OrderId { get; set; }

    /// <summary>
    /// Gets the user identifier that placed this order
    /// </summary>
    public string UserId { get; set; }
    
    /// <summary>
    /// Gets the list of product identifiers in this order
    /// </summary>
    public IReadOnlyList<string> Products { get; set; }
    
    /// <summary>
    /// Gets the date when the order was created
    /// </summary>
    public DateTime OrderDate { get; set; }
    
    /// <summary>
    /// Gets the type of the order (Standard or Priority)
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public OrderType OrderType { get; set; }
    
    /// <summary>
    /// Gets the current status of the order
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public OrderStatus OrderStatus { get; set; }
    
    /// <summary>
    /// Gets the total price of the order
    /// </summary>
    public decimal TotalPrice { get; set; }

    /// <summary>
    /// Creates an empty order DTO
    /// </summary>
    public OrderDto()
    {
        OrderId = string.Empty;
        UserId = string.Empty;
        Products = Array.Empty<string>();
    }

    /// <summary>
    /// Creates an order DTO from a domain Order
    /// </summary>
    /// <param name="order">The domain order to convert</param>
    public OrderDto(Order order)
    {
        OrderId = order.OrderId.Value;
        UserId = order.UserId.Value;
        Products = order.Products;
        OrderDate = order.OrderDate;
        OrderType = order.OrderType;
        OrderStatus = order.OrderStatus;
        TotalPrice = order.TotalPrice;
    }
} 