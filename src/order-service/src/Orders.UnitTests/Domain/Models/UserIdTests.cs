// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Orders.Core.Domain.Models;

namespace Orders.UnitTests.Domain.Models;

public class UserIdTests
{
    [Fact]
    public void Constructor_WithValidValue_CreatesUserId()
    {
        // Arrange
        var value = "user123";
        
        // Act
        var userId = new UserId(value);
        
        // Assert
        userId.Value.Should().Be(value);
    }
    
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" ")]
    public void Constructor_WithInvalidValue_ThrowsArgumentException(string invalidValue)
    {
        // Act & Assert
        var exception = Assert.Throws<ArgumentException>(() => new UserId(invalidValue));
        exception.Message.Should().Contain("User ID cannot be null or empty");
        exception.ParamName.Should().Be("value");
    }
    
    [Fact]
    public void ImplicitConversion_ToStringReturnsValue()
    {
        // Arrange
        var value = "user123";
        var userId = new UserId(value);
        
        // Act
        string result = userId;
        
        // Assert
        result.Should().Be(value);
    }
    
    [Fact]
    public void ExplicitConversion_FromStringCreatesUserId()
    {
        // Arrange
        var value = "user123";
        
        // Act
        var userId = (UserId)value;
        
        // Assert
        userId.Value.Should().Be(value);
    }
    
    [Fact]
    public void ToString_ReturnsValue()
    {
        // Arrange
        var value = "user123";
        var userId = new UserId(value);
        
        // Act
        var result = userId.ToString();
        
        // Assert
        result.Should().Be(value);
    }
    
    [Fact]
    public void Equals_WithSameValue_ReturnsTrue()
    {
        // Arrange
        var value = "user123";
        var userId1 = new UserId(value);
        var userId2 = new UserId(value);
        
        // Act & Assert
        userId1.Should().Be(userId2);
    }
    
    [Fact]
    public void Equals_WithDifferentValue_ReturnsFalse()
    {
        // Arrange
        var userId1 = new UserId("user123");
        var userId2 = new UserId("user456");
        
        // Act & Assert
        userId1.Should().NotBe(userId2);
    }
    
    [Fact]
    public void GetHashCode_WithSameValue_ReturnsSameHashCode()
    {
        // Arrange
        var value = "user123";
        var userId1 = new UserId(value);
        var userId2 = new UserId(value);
        
        // Act & Assert
        userId1.GetHashCode().Should().Be(userId2.GetHashCode());
    }
} 