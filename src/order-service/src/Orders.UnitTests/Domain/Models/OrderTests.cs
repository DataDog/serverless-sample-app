// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using NJsonSchema;
using Orders.Core.Domain.Exceptions;
using Orders.Core.Domain.Models;

namespace Orders.UnitTests.Domain.Models;

public class OrderTests
{
    private readonly UserId _userId = new UserId("test-user");
    private readonly List<string> _products = new() { "product1", "product2", "product3" };

    #region Creation Tests
    
    [Fact]
    public void CreateStandard_WithValidInputs_CreatesOrderWithCorrectProperties()
    {
        // Act
        var order = Order.CreateStandard(_userId, _products);
        
        // Assert
        order.Should().NotBeNull();
        order.UserId.Should().Be(_userId);
        order.OrderId.Should().NotBeNull();
        order.Products.Should().BeEquivalentTo(_products);
        order.OrderStatus.Should().Be(OrderStatus.Created);
        order.OrderType.Should().Be(OrderType.Standard);
        order.TotalPrice.Should().Be(0);
        order.OrderDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }
    
    [Fact]
    public void CreatePriority_WithValidInputs_CreatesOrderWithCorrectProperties()
    {
        // Act
        var order = Order.CreatePriority(_userId, _products);
        
        // Assert
        order.Should().NotBeNull();
        order.UserId.Should().Be(_userId);
        order.OrderId.Should().NotBeNull();
        order.Products.Should().BeEquivalentTo(_products);
        order.OrderStatus.Should().Be(OrderStatus.Created);
        order.OrderType.Should().Be(OrderType.Priority);
        order.TotalPrice.Should().Be(0);
        order.OrderDate.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }
    
    [Fact]
    public void Reconstitute_WithValidInputs_CreatesOrderWithCorrectProperties()
    {
        // Arrange
        var orderId = "test-order-id";
        var userId = "test-user";
        var products = new List<string> { "product1", "product2" };
        var orderDate = DateTime.UtcNow.AddDays(-1);
        var orderType = OrderType.Priority;
        var orderStatus = OrderStatus.Confirmed;
        var totalPrice = 100.50m;
        
        // Act
        var order = Order.Reconstitute(
            orderId,
            userId,
            products,
            orderDate,
            orderType,
            orderStatus,
            totalPrice);
        
        // Assert
        order.Should().NotBeNull();
        order.OrderId.Value.Should().Be(orderId);
        order.UserId.Value.Should().Be(userId);
        order.Products.Should().BeEquivalentTo(products);
        order.OrderDate.Should().Be(orderDate);
        order.OrderType.Should().Be(orderType);
        order.OrderStatus.Should().Be(orderStatus);
        order.TotalPrice.Should().Be(totalPrice);
    }
    
    #endregion
    
    #region State Transition Tests
    
    [Fact]
    public void MarkStockReservationFailed_SetsOrderStatusToNoStock()
    {
        // Arrange
        var order = Order.CreateStandard(_userId, _products);
        
        // Act
        order.MarkStockReservationFailed();
        
        // Assert
        order.OrderStatus.Should().Be(OrderStatus.NoStock);
    }
    
    [Fact]
    public void Confirm_WithCreatedStatus_ChangesStatusToConfirmed()
    {
        // Arrange
        var order = Order.CreateStandard(_userId, _products);
        
        // Act
        order.Confirm();
        
        // Assert
        order.OrderStatus.Should().Be(OrderStatus.Confirmed);
    }
    
    [Theory]
    [InlineData(OrderStatus.Confirmed)]
    [InlineData(OrderStatus.Completed)]
    [InlineData(OrderStatus.NoStock)]
    public void Confirm_WithNonCreatedStatus_ThrowsInvalidOrderStateException(OrderStatus initialStatus)
    {
        // Arrange
        var order = Order.Reconstitute(
            "test-order-id",
            _userId.Value,
            _products,
            DateTime.UtcNow,
            OrderType.Standard,
            initialStatus,
            0);
        
        // Act & Assert
        var exception = Assert.Throws<InvalidOrderStateException>(() => order.Confirm());
        exception.Message.Should().Contain($"Cannot confirm order in status: {initialStatus}");
    }
    
    [Fact]
    public void Complete_WithConfirmedStatus_ChangesStatusToCompleted()
    {
        // Arrange
        var order = Order.CreateStandard(_userId, _products);
        order.Confirm(); // First confirm the order
        
        // Act
        order.Complete();
        
        // Assert
        order.OrderStatus.Should().Be(OrderStatus.Completed);
    }
    
    [Theory]
    [InlineData(OrderStatus.Created)]
    [InlineData(OrderStatus.Completed)]
    [InlineData(OrderStatus.NoStock)]
    public void Complete_WithNonConfirmedStatus_ThrowsOrderNotConfirmedException(OrderStatus initialStatus)
    {
        // Arrange
        var order = Order.Reconstitute(
            "test-order-id",
            _userId.Value,
            _products,
            DateTime.UtcNow,
            OrderType.Standard,
            initialStatus,
            0);
        
        // Act & Assert
        Assert.Throws<OrderNotConfirmedException>(() => order.Complete());
    }
    
    #endregion
    
    #region Price Setting Tests
    
    [Theory]
    [InlineData(0)]
    [InlineData(0.01)]
    [InlineData(100.50)]
    [InlineData(999999.99)]
    public void SetPrice_WithValidPrice_SetsTotalPrice(decimal price)
    {
        // Arrange
        var order = Order.CreateStandard(_userId, _products);
        
        // Act
        order.SetPrice(price);
        
        // Assert
        order.TotalPrice.Should().Be(price);
    }
    
    [Theory]
    [InlineData(-0.01)]
    [InlineData(-100)]
    public void SetPrice_WithNegativePrice_ThrowsArgumentException(decimal price)
    {
        // Arrange
        var order = Order.CreateStandard(_userId, _products);
        
        // Act & Assert
        var exception = Assert.Throws<ArgumentException>(() => order.SetPrice(price));
        exception.Message.Should().Contain("Price cannot be negative");
        exception.ParamName.Should().Be("price");
    }
    
    #endregion
    
    #region Order Number Property Tests
    
    [Fact]
    public void OrderNumber_ReturnsOrderIdValue()
    {
        // Arrange
        var orderId = "test-order-id";
        var order = Order.Reconstitute(
            orderId,
            _userId.Value,
            _products,
            DateTime.UtcNow,
            OrderType.Standard,
            OrderStatus.Created,
            0);
        
        // Act
        var orderNumber = order.OrderNumber;
        
        // Assert
        orderNumber.Should().Be(orderId);
    }
    
    #endregion
    
    #region Fuzzing Tests
    
    [Theory]
    [InlineData(OrderStatus.Created, OrderStatus.Created, OrderStatus.Confirmed, OrderStatus.Confirmed, OrderStatus.Completed)]
    [InlineData(OrderStatus.Created, OrderStatus.NoStock, OrderStatus.NoStock, OrderStatus.NoStock, OrderStatus.NoStock)]
    public void MultipleStateTransitions_FollowExpectedPath(
        OrderStatus initial,
        OrderStatus afterStockFailure,
        OrderStatus afterConfirm,
        OrderStatus afterSecondStockFailure,
        OrderStatus afterComplete)
    {
        // Arrange
        var order = Order.Reconstitute(
            "test-order-id",
            _userId.Value,
            _products,
            DateTime.UtcNow,
            OrderType.Standard,
            initial,
            0);
        
        // Act & Assert - Step 1: Mark stock reservation failed
        if (initial == OrderStatus.Created)
        {
            order.MarkStockReservationFailed();
            order.OrderStatus.Should().Be(afterStockFailure);
        }
        
        // Act & Assert - Step 2: Try to confirm
        try
        {
            order.Confirm();
            // Only succeeds if we're in Created state
            order.OrderStatus.Should().Be(afterConfirm);
        }
        catch (InvalidOrderStateException)
        {
            // Exception expected if not in Created state
            order.OrderStatus.Should().Be(afterStockFailure);
        }
        
        // Act & Assert - Step 3: Mark stock reservation failed again
        order.MarkStockReservationFailed();
        order.OrderStatus.Should().Be(afterSecondStockFailure);
        
        // Act & Assert - Step 4: Try to complete
        try
        {
            order.Complete();
            // Only succeeds if we're in Confirmed state
            order.OrderStatus.Should().Be(afterComplete);
        }
        catch (OrderNotConfirmedException)
        {
            // Exception expected if not in Confirmed state
            order.OrderStatus.Should().Be(afterSecondStockFailure);
        }
    }
    
    [Fact]
    public void CreateStandard_WithEmptyProductList_CreatesOrderWithEmptyProducts()
    {
        // Arrange
        var emptyProducts = new List<string>();
        
        // Act
        var order = Order.CreateStandard(_userId, emptyProducts);
        
        // Assert
        order.Products.Should().BeEmpty();
    }
    
    [Fact]
    public void CreateStandard_WithVeryLargeProductList_CreatesOrderWithAllProducts()
    {
        // Arrange
        var largeProductList = Enumerable.Range(1, 1000).Select(i => $"product{i}").ToList();
        
        // Act
        var order = Order.CreateStandard(_userId, largeProductList);
        
        // Assert
        order.Products.Count.Should().Be(1000);
        order.Products.Should().BeEquivalentTo(largeProductList);
    }
    
    #endregion
} 