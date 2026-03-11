// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json;
using System.Text.Json.Nodes;
using Amazon;
using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Orders.Core.Adapters;
using Orders.Core.PublicEvents;
using Orders.Core.Telemetry;

namespace Orders.UnitTests.Adapters;

public class EventBridgeEventPublisherTests
{
    private readonly Mock<AmazonEventBridgeClient> _eventBridgeClientMock;
    private readonly Mock<ITransactionTracker> _transactionTrackerMock = new();
    private readonly EventBridgeEventPublisher _publisher;
    private PutEventsRequest? _capturedRequest;

    public EventBridgeEventPublisherTests()
    {
        _eventBridgeClientMock = new Mock<AmazonEventBridgeClient>(new AmazonEventBridgeConfig { RegionEndpoint = RegionEndpoint.USEast1 });
        _eventBridgeClientMock
            .Setup(c => c.PutEventsAsync(It.IsAny<PutEventsRequest>(), default))
            .Callback<PutEventsRequest, CancellationToken>((req, _) => _capturedRequest = req)
            .ReturnsAsync(new PutEventsResponse
            {
                FailedEntryCount = 0,
                HttpStatusCode = System.Net.HttpStatusCode.OK
            });

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ENV"] = "test",
                ["EVENT_BUS_NAME"] = "test-bus"
            })
            .Build();

        var logger = new Mock<ILogger<EventBridgeEventPublisher>>();

        _publisher = new EventBridgeEventPublisher(
            logger.Object,
            configuration,
            _transactionTrackerMock.Object,
            _eventBridgeClientMock.Object);
    }

    [Fact]
    public async Task Publish_ShouldSendEventToEventBridge()
    {
        var orderCreatedEvent = new OrderCreatedEventV1
        {
            OrderNumber = "ORD-001",
            UserId = "user-123",
            Products = new[] { "product-1", "product-2" }
        };

        await _publisher.Publish(orderCreatedEvent);

        _capturedRequest.Should().NotBeNull();
        _capturedRequest!.Entries.Should().HaveCount(1);

        var entry = _capturedRequest.Entries[0];
        entry.EventBusName.Should().Be("test-bus");
        entry.Source.Should().Be("test.orders");
        entry.DetailType.Should().Be("orders.orderCreated.v1");
    }

    [Fact]
    public async Task Publish_ShouldSerializeEventDetailAsValidJson()
    {
        var orderCreatedEvent = new OrderCreatedEventV1
        {
            OrderNumber = "ORD-001",
            UserId = "user-123",
            Products = new[] { "product-1" }
        };

        await _publisher.Publish(orderCreatedEvent);

        _capturedRequest.Should().NotBeNull();

        var detail = _capturedRequest!.Entries[0].Detail;
        var parsed = JsonNode.Parse(detail);
        parsed.Should().NotBeNull();
    }

    [Fact]
    public void JsonNodeCarrier_WhenMutatedInCallback_RetainsMutations()
    {
        var originalJson = JsonSerializer.Serialize(new OrderCreatedEventV1
        {
            OrderNumber = "ORD-001",
            UserId = "user-123",
            Products = new[] { "product-1" }
        });

        var carrier = JsonNode.Parse(originalJson)!;

        Action<JsonNode, string, string> setHeader = (node, key, value) =>
        {
            if (node["_datadog"] == null) node["_datadog"] = new JsonObject();
            node["_datadog"]![key] = value;
        };

        setHeader(carrier, "x-datadog-trace-id", "12345");
        setHeader(carrier, "x-datadog-parent-id", "67890");
        setHeader(carrier, "dd-pathway-ctx", "encoded-pathway");

        var resultJson = carrier.ToJsonString();
        var resultNode = JsonNode.Parse(resultJson);

        resultNode!["_datadog"].Should().NotBeNull();
        resultNode!["_datadog"]!["x-datadog-trace-id"]!.GetValue<string>().Should().Be("12345");
        resultNode!["_datadog"]!["x-datadog-parent-id"]!.GetValue<string>().Should().Be("67890");
        resultNode!["_datadog"]!["dd-pathway-ctx"]!.GetValue<string>().Should().Be("encoded-pathway");
    }

    [Fact]
    public void StringCarrier_WhenMutatedInCallback_DoesNotRetainMutations()
    {
        var originalJson = JsonSerializer.Serialize(new OrderCreatedEventV1
        {
            OrderNumber = "ORD-001",
            UserId = "user-123",
            Products = new[] { "product-1" }
        });

        var carrier = originalJson;

        Action<string, string, string> setHeader = (eventJson, key, value) =>
        {
            var jsonNode = JsonNode.Parse(eventJson);
            if (jsonNode?["_datadog"] == null) jsonNode!["_datadog"] = new JsonObject();
            jsonNode!["_datadog"]![key] = value;
        };

        setHeader(carrier, "x-datadog-trace-id", "12345");

        var resultNode = JsonNode.Parse(carrier);
        resultNode!["_datadog"].Should().BeNull("string carrier mutations are lost - this was the original bug");
    }
}
