// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Orders.Core.Domain.Exceptions;
using Orders.Core.Domain.Models;

namespace Orders.UnitTests.FuzzTests;

/// <summary>
/// Fuzzing tests for the Order domain model
/// These tests attempt to stress test the model with unusual inputs and edge cases
/// </summary>
public class OrderFuzzTests
{
    #region UserId Fuzzing Tests
    
    [Fact]
    public void CreateStandard_WithVeryLongUserId_CreatesOrderSuccessfully()
    {
        // Arrange
        var longUserId = new string('x', 10000);
        var userId = new UserId(longUserId);
        var products = new List<string> { "product1" };
        
        // Act
        var order = Order.CreateStandard(userId, products);
        
        // Assert
        order.Should().NotBeNull();
        order.UserId.Value.Should().Be(longUserId);
    }
    
    [Fact]
    public void CreateStandard_WithSpecialCharactersInUserId_CreatesOrderSuccessfully()
    {
        // Arrange
        var specialUserId = "!@#$%^&*()_+{}|:<>?~`-=[]\\;',./";
        var userId = new UserId(specialUserId);
        var products = new List<string> { "product1" };
        
        // Act
        var order = Order.CreateStandard(userId, products);
        
        // Assert
        order.Should().NotBeNull();
        order.UserId.Value.Should().Be(specialUserId);
    }
    
    #endregion
    
    #region Products Fuzzing Tests
    
    [Fact]
    public void CreateStandard_WithEmptyProductList_CreatesOrderWithEmptyProducts()
    {
        // Arrange
        var userId = new UserId("test-user");
        var emptyProducts = new List<string>();
        
        // Act
        var order = Order.CreateStandard(userId, emptyProducts);
        
        // Assert
        order.Should().NotBeNull();
        order.Products.Should().BeEmpty();
    }
    
    [Fact]
    public void CreateStandard_WithNullProductsArgument_ThrowsArgumentNullException()
    {
        // Arrange
        var userId = new UserId("test-user");
        IEnumerable<string> nullProducts = null;
        
        // Act & Assert
        Assert.Throws<ArgumentNullException>(() => Order.CreateStandard(userId, nullProducts));
    }
    
    [Fact]
    public void CreateStandard_WithVeryLargeProductList_CreatesOrderSuccessfully()
    {
        // Arrange
        var userId = new UserId("test-user");
        var largeProductList = Enumerable.Range(1, 10000).Select(i => $"product{i}").ToList();
        
        // Act
        var order = Order.CreateStandard(userId, largeProductList);
        
        // Assert
        order.Should().NotBeNull();
        order.Products.Count.Should().Be(10000);
    }
    
    [Fact]
    public void CreateStandard_WithProductsContainingSpecialCharacters_CreatesOrderSuccessfully()
    {
        // Arrange
        var userId = new UserId("test-user");
        var specialProducts = new List<string>
        {
            "!@#$%^&*()",
            "<>?:\"{}|",
            "\\;',./[]",
            "±§`~¡™£¢∞§¶•ªº–≠"
        };
        
        // Act
        var order = Order.CreateStandard(userId, specialProducts);
        
        // Assert
        order.Should().NotBeNull();
        order.Products.Should().BeEquivalentTo(specialProducts);
    }
    
    [Fact]
    public void CreateStandard_WithVeryLongProductIds_CreatesOrderSuccessfully()
    {
        // Arrange
        var userId = new UserId("test-user");
        var longProductId = new string('x', 10000);
        var products = new List<string> { longProductId };
        
        // Act
        var order = Order.CreateStandard(userId, products);
        
        // Assert
        order.Should().NotBeNull();
        order.Products.Should().ContainSingle().Which.Should().Be(longProductId);
    }
    
    #endregion
    
    #region Price Fuzzing Tests
    
    [Theory]
    [InlineData(0)]
    [InlineData(0.0001)]
    [InlineData(9999999999.99)]
    public void SetPrice_WithExtremeValues_SetsPriceCorrectly(decimal price)
    {
        // Arrange
        var userId = new UserId("test-user");
        var products = new List<string> { "product1" };
        var order = Order.CreateStandard(userId, products);
        
        // Act
        order.SetPrice(price);
        
        // Assert
        order.TotalPrice.Should().Be(price);
    }
    
    [Fact]
    public void SetPrice_WithDecimalMaxValue_SetsPriceCorrectly()
    {
        // Arrange
        var userId = new UserId("test-user");
        var products = new List<string> { "product1" };
        var order = Order.CreateStandard(userId, products);
        var maxValue = decimal.MaxValue;
        
        // Act
        order.SetPrice(maxValue);
        
        // Assert
        order.TotalPrice.Should().Be(maxValue);
    }
    
    #endregion
    
    #region State Transition Fuzzing Tests
    
    [Fact]
    public void MultipleStateTransitions_WithRandomSequence_MaintainsConsistency()
    {
        // Arrange
        var userId = new UserId("test-user");
        var products = new List<string> { "product1" };
        var order = Order.CreateStandard(userId, products);
        var random = new Random();
        
        // Act & Assert
        for (int i = 0; i < 100; i++)
        {
            var action = random.Next(3);
            
            switch (action)
            {
                case 0: // Try to mark stock reservation failed
                    order.MarkStockReservationFailed();
                    order.OrderStatus.Should().Be(OrderStatus.NoStock);
                    break;
                
                case 1: // Try to confirm
                    try
                    {
                        order.Confirm();
                        order.OrderStatus.Should().Be(OrderStatus.Confirmed);
                    }
                    catch (InvalidOrderStateException)
                    {
                        // Exception expected if not in Created state
                        order.OrderStatus.Should().NotBe(OrderStatus.Created);
                    }
                    break;
                
                case 2: // Try to complete
                    try
                    {
                        order.Complete();
                        order.OrderStatus.Should().Be(OrderStatus.Completed);
                    }
                    catch (OrderNotConfirmedException)
                    {
                        // Exception expected if not in Confirmed state
                        order.OrderStatus.Should().NotBe(OrderStatus.Confirmed);
                    }
                    break;
            }
        }
    }
    
    #endregion
    
    #region Reconstitute Fuzzing Tests
    
    [Fact]
    public void Reconstitute_WithExtremeDateTime_CreatesOrderSuccessfully()
    {
        // Arrange
        var orderId = "test-order-id";
        var userId = "test-user";
        var products = new List<string> { "product1" };
        var extremeDateTimes = new[]
        {
            DateTime.MinValue,
            DateTime.MaxValue,
            new DateTime(1, 1, 1),
            new DateTime(9999, 12, 31, 23, 59, 59, 999)
        };
        
        foreach (var dateTime in extremeDateTimes)
        {
            // Act
            var order = Order.Reconstitute(
                orderId,
                userId,
                products,
                dateTime,
                OrderType.Standard,
                OrderStatus.Created,
                0);
            
            // Assert
            order.Should().NotBeNull();
            order.OrderDate.Should().Be(dateTime);
        }
    }
    
    [Theory]
    [InlineData("")]  // Empty string should throw in OrderId constructor
    public void Reconstitute_WithInvalidOrderId_ThrowsArgumentException(string invalidOrderId)
    {
        // Arrange
        var userId = "test-user";
        var products = new List<string> { "product1" };
        
        // Act & Assert
        Assert.Throws<ArgumentException>(() => Order.Reconstitute(
            invalidOrderId,
            userId,
            products,
            DateTime.UtcNow,
            OrderType.Standard,
            OrderStatus.Created,
            0));
    }
    
    [Theory]
    [InlineData("")]  // Empty string should throw in UserId constructor
    public void Reconstitute_WithInvalidUserId_ThrowsArgumentException(string invalidUserId)
    {
        // Arrange
        var orderId = "test-order-id";
        var products = new List<string> { "product1" };
        
        // Act & Assert
        Assert.Throws<ArgumentException>(() => Order.Reconstitute(
            orderId,
            invalidUserId,
            products,
            DateTime.UtcNow,
            OrderType.Standard,
            OrderStatus.Created,
            0));
    }
    
    #endregion
} 