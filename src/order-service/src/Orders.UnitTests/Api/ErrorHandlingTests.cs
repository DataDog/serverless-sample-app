// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json;
using Orders.Api.Models;
using Orders.Core.Common;

namespace Orders.UnitTests.Api;

public class ErrorHandlingTests
{
    [Fact]
    public void ErrorResponse_SerializesToJson_WithCorrectFormat()
    {
        // Arrange
        var errorResponse = new ErrorResponse(
            ErrorCodes.ValidationError,
            "Test error message",
            "Test details",
            new Dictionary<string, string[]>
            {
                ["field1"] = new[] { "error1", "error2" },
                ["field2"] = new[] { "error3" }
            },
            "test-correlation-id"
        );

        // Act
        var json = JsonSerializer.Serialize(errorResponse, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        // Assert
        json.Should().Contain("\"error\":\"VALIDATION_ERROR\"");
        json.Should().Contain("\"message\":\"Test error message\"");
        json.Should().Contain("\"details\":\"Test details\"");
        json.Should().Contain("\"correlationId\":\"test-correlation-id\"");
        json.Should().Contain("\"validationErrors\"");
    }

    [Fact]
    public void ValidationErrorResponse_SerializesToJson_WithCorrectFormat()
    {
        // Arrange
        var validationErrors = new Dictionary<string, string[]>
        {
            ["Products"] = new[] { "At least one product must be specified" },
            ["UserId"] = new[] { "User ID is required" }
        };

        var errorResponse = new ValidationErrorResponse(
            ErrorCodes.ValidationError,
            validationErrors,
            "test-correlation-id"
        );

        // Act
        var json = JsonSerializer.Serialize(errorResponse, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        // Assert
        json.Should().Contain("\"error\":\"VALIDATION_ERROR\"");
        json.Should().Contain("\"correlationId\":\"test-correlation-id\"");
        json.Should().Contain("\"validationErrors\"");
        json.Should().Contain("\"Products\"");
        json.Should().Contain("\"UserId\"");
    }

    [Fact]
    public void Result_Success_HasCorrectProperties()
    {
        // Arrange
        var value = "test-value";

        // Act
        var result = ResultExtensions.Success(value);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.IsFailure.Should().BeFalse();
        result.Should().BeOfType<Success<string>>();
        var success = result as Success<string>;
        success!.Value.Should().Be(value);
    }

    [Fact]
    public void Result_Failure_HasCorrectProperties()
    {
        // Arrange
        var errorCode = ErrorCodes.ValidationError;
        var errorMessage = "Test error";
        var exception = new ArgumentException("Test exception");

        // Act
        var result = ResultExtensions.Failure<string>(errorCode, errorMessage, exception);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.IsFailure.Should().BeTrue();
        result.Should().BeOfType<Failure<string>>();
        var failure = result as Failure<string>;
        failure!.ErrorCode.Should().Be(errorCode);
        failure.ErrorMessage.Should().Be(errorMessage);
        failure.Exception.Should().Be(exception);
    }

    [Fact]
    public void Result_Map_TransformsSuccessValue()
    {
        // Arrange
        var originalResult = ResultExtensions.Success(5);

        // Act
        var mappedResult = originalResult.Map(x => x.ToString());

        // Assert
        mappedResult.IsSuccess.Should().BeTrue();
        mappedResult.Should().BeOfType<Success<string>>();
        var success = mappedResult as Success<string>;
        success!.Value.Should().Be("5");
    }

    [Fact]
    public void Result_Map_PreservesFailure()
    {
        // Arrange
        var originalResult = ResultExtensions.Failure<int>(ErrorCodes.ValidationError, "Test error");

        // Act
        var mappedResult = originalResult.Map(x => x.ToString());

        // Assert
        mappedResult.IsFailure.Should().BeTrue();
        mappedResult.Should().BeOfType<Failure<string>>();
        var failure = mappedResult as Failure<string>;
        failure!.ErrorCode.Should().Be(ErrorCodes.ValidationError);
        failure.ErrorMessage.Should().Be("Test error");
    }
}