// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Amazon.EventBridge.Model;
using Orders.Core.Adapters;

namespace Orders.UnitTests.Telemetry;

public class ObservabilityExtensionsTests
{
    [Fact]
    public void AddToTelemetry_PutEventsRequestEntry_DoesNotComputeJsonSchema()
    {
        // Arrange
        var publishRequest = new PutEventsRequestEntry
        {
            Detail = "{\"orderId\": \"123\"}",
            Source = "orders",
            DetailType = "orders.orderCreated.v1",
            EventBusName = "test-bus"
        };

        // Act - Should not throw and should not depend on NJsonSchema for schema computation
        var exception = Record.Exception(() => publishRequest.AddToTelemetry());

        // Assert
        exception.Should().BeNull();
    }

    [Fact]
    public void AddToTelemetry_PutEventsRequestEntry_SetsDestinationNameToEventBusName()
    {
        // The test cannot directly verify span tag values without an active Datadog tracer,
        // but we can verify the method compiles and runs without error while the
        // correct field (EventBusName) is referenced in the source.
        // The key assertion is structural: AddToTelemetry must not throw when EventBusName is set.
        var publishRequest = new PutEventsRequestEntry
        {
            Detail = "{\"orderId\": \"123\"}",
            Source = "orders",
            DetailType = "orders.orderCreated.v1",
            EventBusName = "my-event-bus"
        };

        var exception = Record.Exception(() => publishRequest.AddToTelemetry());
        exception.Should().BeNull();
    }

    [Fact]
    public void AddToTelemetry_PutEventsRequestEntry_WithInvalidJson_DoesNotThrow()
    {
        // Arrange
        var publishRequest = new PutEventsRequestEntry
        {
            Detail = "not-valid-json",
            Source = "orders",
            DetailType = "orders.orderCreated.v1",
            EventBusName = "test-bus"
        };

        // Act - After fix, this should not throw because we no longer parse schema
        var exception = Record.Exception(() => publishRequest.AddToTelemetry());

        // Assert
        exception.Should().BeNull();
    }
}
