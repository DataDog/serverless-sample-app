// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json.Serialization;
using Orders.Core.Adapters;

namespace Orders.Core;

public enum OrderStatus
{
    Created,
    Confirmed,
    Completed,
    NoStock
}

public enum OrderType
{
    Standard,
    Priority
}

public record Order
{
    [JsonConstructor]
    private Order()
    {
    }
    
    public static Order CreateStandardOrder(string userId, string[] products)
    {
        var orderId = Guid.NewGuid().ToString();
        orderId.AddToTelemetry("order.id");
        
        return new Order()
        {
            UserId = userId,
            OrderNumber = orderId,
            OrderDate = DateTime.UtcNow,
            OrderType = OrderType.Standard,
            TotalPrice = 0,
            Products = products,
            OrderStatus = OrderStatus.Created
        };
    }
    
    public static Order CreatePriorityOrder(string userId, string[] products)
    {
        var orderId = Guid.NewGuid().ToString();
        orderId.AddToTelemetry("order.id");
        
        return new Order()
        {
            UserId = userId,
            OrderNumber = orderId,
            OrderDate = DateTime.UtcNow,
            OrderType = OrderType.Priority,
            TotalPrice = 0,
            Products = products,
            OrderStatus = OrderStatus.Created
        };
    }
    
    internal static Order From(string userId, string orderId, DateTime orderDate, OrderType orderType, decimal totalPrice, string[] products, OrderStatus status)
    {
        return new Order()
        {
            UserId = userId,
            OrderNumber = orderId,
            OrderDate = orderDate,
            OrderType = orderType,
            TotalPrice = totalPrice,
            Products = products,
            OrderStatus = status
        };
    }
    
    public OrderStatus OrderStatus { get; set; }

    public string OrderNumber { get; set; } = "";

    public string UserId { get; set; } = "";
    
    public string[] Products { get; set; } = [];
    
    public DateTime OrderDate { get; init; }
    
    public OrderType OrderType { get; init; }
    
    public decimal TotalPrice { get; set; }

    public void ReservationFailed()
    {
        OrderStatus = OrderStatus.NoStock;
    }
    
    public void ConfirmOrder()
    {
        if (OrderStatus != OrderStatus.Created)
        {
            return;
        }

        OrderStatus = OrderStatus.Confirmed;
    }

    public void CompleteOrder()
    {
        if (OrderStatus != OrderStatus.Confirmed)
        {
            throw new OrderNotConfirmedException();
        }
        
        OrderStatus = OrderStatus.Completed;
    }
}