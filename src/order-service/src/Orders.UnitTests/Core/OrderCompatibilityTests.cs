// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2026 Datadog, Inc.

using Orders.Core.Domain.Exceptions;
using CoreOrder = Orders.Core.Order;
using OrderStatus = Orders.Core.OrderStatus;

namespace Orders.UnitTests.Core;

public class OrderCompatibilityTests
{
    [Theory]
    [InlineData(OrderStatus.Confirmed)]
    [InlineData(OrderStatus.Completed)]
    [InlineData(OrderStatus.NoStock)]
    public void ConfirmOrder_WithNonCreatedStatus_ThrowsInvalidOrderStateException(OrderStatus status)
    {
        var order = CoreOrder.CreateStandardOrder("user-1", new[] { "product-1" });
        order.OrderStatus = status;

        var action = () => order.ConfirmOrder();

        action.Should().Throw<InvalidOrderStateException>()
            .WithMessage($"Cannot confirm order in status: {status}");
    }
}
