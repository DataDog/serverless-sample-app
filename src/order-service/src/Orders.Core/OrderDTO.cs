// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json.Serialization;

namespace Orders.Core;

public record OrderDTO
{
    public OrderDTO(Order order)
    {
        OrderId = order.OrderNumber;
        OrderDate= order.OrderDate;
        Products = order.Products;
    }
    [JsonPropertyName("orderId")]
    public string OrderId { get; set; }
    
    [JsonPropertyName("orderDate")]
    public DateTime OrderDate { get; set; }

    [JsonPropertyName("products")]
    public string[] Products { get; set; }
    
}