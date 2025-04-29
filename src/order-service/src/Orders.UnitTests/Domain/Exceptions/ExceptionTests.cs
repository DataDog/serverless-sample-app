// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Orders.Core.Domain.Exceptions;

namespace Orders.UnitTests.Domain.Exceptions;

public class ExceptionTests
{
    #region InvalidOrderStateException Tests
    
    [Fact]
    public void InvalidOrderStateException_DefaultConstructor_CreatesExceptionWithDefaultMessage()
    {
        // Act
        var exception = new InvalidOrderStateException();
        
        // Assert
        exception.Message.Should().Be("The order is in an invalid state for the requested operation.");
        exception.InnerException.Should().BeNull();
    }
    
    [Fact]
    public void InvalidOrderStateException_MessageConstructor_CreatesExceptionWithCustomMessage()
    {
        // Arrange
        var message = "Custom error message";
        
        // Act
        var exception = new InvalidOrderStateException(message);
        
        // Assert
        exception.Message.Should().Be(message);
        exception.InnerException.Should().BeNull();
    }
    
    [Fact]
    public void InvalidOrderStateException_MessageAndInnerExceptionConstructor_CreatesExceptionWithBoth()
    {
        // Arrange
        var message = "Custom error message";
        var innerException = new ArgumentException("Inner exception");
        
        // Act
        var exception = new InvalidOrderStateException(message, innerException);
        
        // Assert
        exception.Message.Should().Be(message);
        exception.InnerException.Should().Be(innerException);
    }
    
    #endregion
    
    #region OrderNotConfirmedException Tests
    
    [Fact]
    public void OrderNotConfirmedException_DefaultConstructor_CreatesExceptionWithDefaultMessage()
    {
        // Act
        var exception = new OrderNotConfirmedException();
        
        // Assert
        exception.Message.Should().Be("The order must be confirmed before this operation can be performed.");
        exception.InnerException.Should().BeNull();
    }
    
    [Fact]
    public void OrderNotConfirmedException_MessageConstructor_CreatesExceptionWithCustomMessage()
    {
        // Arrange
        var message = "Custom error message";
        
        // Act
        var exception = new OrderNotConfirmedException(message);
        
        // Assert
        exception.Message.Should().Be(message);
        exception.InnerException.Should().BeNull();
    }
    
    [Fact]
    public void OrderNotConfirmedException_MessageAndInnerExceptionConstructor_CreatesExceptionWithBoth()
    {
        // Arrange
        var message = "Custom error message";
        var innerException = new ArgumentException("Inner exception");
        
        // Act
        var exception = new OrderNotConfirmedException(message, innerException);
        
        // Assert
        exception.Message.Should().Be(message);
        exception.InnerException.Should().Be(innerException);
    }
    
    [Fact]
    public void OrderNotConfirmedException_InheritanceHierarchy_IsInvalidOrderStateException()
    {
        // Act
        var exception = new OrderNotConfirmedException();
        
        // Assert
        exception.Should().BeAssignableTo<InvalidOrderStateException>();
    }
    
    #endregion
    
    #region Exception Handling Tests
    
    [Fact]
    public void Exceptions_CanBeCaughtByBaseTypes()
    {
        // Arrange
        Exception caughtException = null;
        
        // Act
        try
        {
            throw new OrderNotConfirmedException();
        }
        catch (InvalidOrderStateException ex)
        {
            caughtException = ex;
        }
        
        // Assert
        caughtException.Should().NotBeNull();
        caughtException.Should().BeOfType<OrderNotConfirmedException>();
    }
    
    [Fact]
    public void Exceptions_CanBeFiltered()
    {
        // Arrange
        var exceptions = new List<Exception>
        {
            new InvalidOrderStateException("First"),
            new OrderNotConfirmedException("Second"),
            new InvalidOrderStateException("Third")
        };
        
        // Act
        var notConfirmedExceptions = exceptions.OfType<OrderNotConfirmedException>().ToList();
        
        // Assert
        notConfirmedExceptions.Should().HaveCount(1);
        notConfirmedExceptions[0].Message.Should().Be("Second");
    }
    
    #endregion
} 