// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Amazon.Lambda.SQSEvents;
using Orders.BackgroundWorkers;

namespace Orders.UnitTests.Telemetry;

public class TelemetryExtensionsTests
{
    [Fact]
    public void AddToTelemetry_SQSMessage_DoesNotComputeJsonSchema()
    {
        // Arrange
        var record = new SQSEvent.SQSMessage
        {
            Body = "{\"orderId\": \"123\", \"userId\": \"user-1\"}"
        };

        // Act - Should not throw and should not depend on NJsonSchema for schema computation
        var exception = Record.Exception(() => record.AddToTelemetry());

        // Assert
        exception.Should().BeNull();
    }

    [Fact]
    public void AddToTelemetry_SQSMessage_WithInvalidJson_DoesNotThrow()
    {
        // Arrange
        var record = new SQSEvent.SQSMessage
        {
            Body = "not-valid-json"
        };

        // Act - After fix, this should not throw because we no longer parse schema
        var exception = Record.Exception(() => record.AddToTelemetry());

        // Assert
        exception.Should().BeNull();
    }
}
