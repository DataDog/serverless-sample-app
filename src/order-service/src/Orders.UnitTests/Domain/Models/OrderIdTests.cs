// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Orders.Core.Domain.Models;

namespace Orders.UnitTests.Domain.Models;

public class OrderIdTests
{
    [Fact]
    public void Constructor_WithValidValue_CreatesOrderId()
    {
        // Arrange
        var value = "123456";
        
        // Act
        var orderId = new OrderId(value);
        
        // Assert
        orderId.Value.Should().Be(value);
    }
    
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void Constructor_WithInvalidValue_ThrowsArgumentException(string invalidValue)
    {
        // Act & Assert
        var exception = Assert.Throws<ArgumentException>(() => new OrderId(invalidValue));
        exception.Message.Should().Contain("Order ID cannot be null or empty");
        exception.ParamName.Should().Be("value");
    }
    
    [Fact]
    public void CreateNew_ReturnsNewOrderIdWithGuidValue()
    {
        // Act
        var orderId = OrderId.CreateNew();
        
        // Assert
        orderId.Should().NotBeNull();
        orderId.Value.Should().NotBeNullOrWhiteSpace();
        Guid.TryParse(orderId.Value, out _).Should().BeTrue();
    }
    
    [Fact]
    public void ImplicitConversion_ToStringReturnsValue()
    {
        // Arrange
        var value = "123456";
        var orderId = new OrderId(value);
        
        // Act
        string result = orderId;
        
        // Assert
        result.Should().Be(value);
    }
    
    [Fact]
    public void ExplicitConversion_FromStringCreatesOrderId()
    {
        // Arrange
        var value = "123456";
        
        // Act
        var orderId = (OrderId)value;
        
        // Assert
        orderId.Value.Should().Be(value);
    }
    
    [Fact]
    public void ToString_ReturnsValue()
    {
        // Arrange
        var value = "123456";
        var orderId = new OrderId(value);
        
        // Act
        var result = orderId.ToString();
        
        // Assert
        result.Should().Be(value);
    }
    
    [Fact]
    public void Equals_WithSameValue_ReturnsTrue()
    {
        // Arrange
        var value = "123456";
        var orderId1 = new OrderId(value);
        var orderId2 = new OrderId(value);
        
        // Act & Assert
        orderId1.Should().Be(orderId2);
    }
    
    [Fact]
    public void Equals_WithDifferentValue_ReturnsFalse()
    {
        // Arrange
        var orderId1 = new OrderId("123456");
        var orderId2 = new OrderId("654321");
        
        // Act & Assert
        orderId1.Should().NotBe(orderId2);
    }
    
    [Fact]
    public void GetHashCode_WithSameValue_ReturnsSameHashCode()
    {
        // Arrange
        var value = "123456";
        var orderId1 = new OrderId(value);
        var orderId2 = new OrderId(value);
        
        // Act & Assert
        orderId1.GetHashCode().Should().Be(orderId2.GetHashCode());
    }
} 