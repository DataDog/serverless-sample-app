// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json;
using Amazon.Lambda.SQSEvents;
using Datadog.Trace;
using Microsoft.Extensions.Logging;
using Orders.BackgroundWorkers;
using Orders.Core;

namespace Orders.UnitTests.BackgroundWorkers;

public class FunctionsTests
{
    private readonly Mock<IOrderWorkflow> _orderWorkflow;
    private readonly Mock<ILogger<Functions>> _logger;
    private readonly Mock<ITracingProvider> _tracingProvider;
    private readonly Mock<ISpanContext> _extractedContext;
    private readonly Mock<IScope> _scope;
    private readonly Mock<ISpan> _span;
    private readonly Functions _sut;

    public FunctionsTests()
    {
        _orderWorkflow = new Mock<IOrderWorkflow>();
        _logger = new Mock<ILogger<Functions>>();
        _tracingProvider = new Mock<ITracingProvider>();
        _extractedContext = new Mock<ISpanContext>();
        _scope = new Mock<IScope>();
        _span = new Mock<ISpan>();

        _scope.Setup(s => s.Span).Returns(_span.Object);

        _sut = new Functions(_orderWorkflow.Object, _logger.Object, _tracingProvider.Object);
    }

    [Fact]
    public async Task HandleStockReserved_UsesExtractedContextAsParent_NotLambdaActiveSpan()
    {
        var lambdaActiveSpan = new Mock<ISpan>();
        var lambdaSpanContext = new Mock<ISpanContext>();
        lambdaActiveSpan.Setup(s => s.Context).Returns(lambdaSpanContext.Object);

        _tracingProvider.Setup(t => t.GetActiveSpan()).Returns(lambdaActiveSpan.Object);

        _tracingProvider.Setup(t => t.ExtractContextIncludingDsm(
                It.IsAny<JsonDocument>(),
                It.IsAny<Func<JsonDocument, string, IEnumerable<string?>>>(),
                "sns",
                "stock.reserved"))
            .Returns(_extractedContext.Object);

        _tracingProvider.Setup(t => t.StartActiveSpan(
                It.IsAny<string>(),
                It.IsAny<ISpanContext?>()))
            .Returns(_scope.Object);

        _orderWorkflow.Setup(w => w.StockReservationSuccessful(It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        var sqsEvent = CreateSqsEventWithStockReservedMessage("stock.reserved");

        await _sut.HandleStockReserved(sqsEvent);

        _tracingProvider.Verify(t => t.StartActiveSpan(
            It.Is<string>(name => name.Contains("stock.reserved")),
            _extractedContext.Object), Times.Once);

        _tracingProvider.Verify(t => t.StartActiveSpan(
            It.IsAny<string>(),
            lambdaSpanContext.Object), Times.Never);
    }

    [Fact]
    public async Task HandleReservationFailed_UsesExtractedContextAsParent_NotLambdaActiveSpan()
    {
        var lambdaActiveSpan = new Mock<ISpan>();
        var lambdaSpanContext = new Mock<ISpanContext>();
        lambdaActiveSpan.Setup(s => s.Context).Returns(lambdaSpanContext.Object);

        _tracingProvider.Setup(t => t.GetActiveSpan()).Returns(lambdaActiveSpan.Object);

        _tracingProvider.Setup(t => t.ExtractContextIncludingDsm(
                It.IsAny<JsonDocument>(),
                It.IsAny<Func<JsonDocument, string, IEnumerable<string?>>>(),
                "sns",
                "stock.reservation_failed"))
            .Returns(_extractedContext.Object);

        _tracingProvider.Setup(t => t.StartActiveSpan(
                It.IsAny<string>(),
                It.IsAny<ISpanContext?>()))
            .Returns(_scope.Object);

        _orderWorkflow.Setup(w => w.StockReservationFailed(It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        var sqsEvent = CreateSqsEventWithReservationFailedMessage("stock.reservation_failed");

        await _sut.HandleReservationFailed(sqsEvent);

        _tracingProvider.Verify(t => t.StartActiveSpan(
            It.Is<string>(name => name.Contains("stock.reservation_failed")),
            _extractedContext.Object), Times.Once);

        _tracingProvider.Verify(t => t.StartActiveSpan(
            It.IsAny<string>(),
            lambdaSpanContext.Object), Times.Never);
    }

    [Fact]
    public async Task HandleReservationFailed_WhenWorkflowThrows_RecordsExceptionOnSpan()
    {
        _tracingProvider.Setup(t => t.ExtractContextIncludingDsm(
                It.IsAny<JsonDocument>(),
                It.IsAny<Func<JsonDocument, string, IEnumerable<string?>>>(),
                It.IsAny<string>(),
                It.IsAny<string>()))
            .Returns(_extractedContext.Object);

        _tracingProvider.Setup(t => t.StartActiveSpan(
                It.IsAny<string>(),
                It.IsAny<ISpanContext?>()))
            .Returns(_scope.Object);

        var expectedException = new InvalidOperationException("workflow failure");
        _orderWorkflow.Setup(w => w.StockReservationFailed(It.IsAny<string>()))
            .ThrowsAsync(expectedException);

        var sqsEvent = CreateSqsEventWithReservationFailedMessage("stock.reservation_failed");

        var result = await _sut.HandleReservationFailed(sqsEvent);

        result.BatchItemFailures.Should().HaveCount(1);
        _span.Verify(s => s.SetException(expectedException), Times.Once);
    }

    [Fact]
    public async Task HandleReservationFailed_ExtractsContextFromFullSqsBody_NotJustDetail()
    {
        JsonDocument? capturedDocument = null;

        _tracingProvider.Setup(t => t.ExtractContextIncludingDsm(
                It.IsAny<JsonDocument>(),
                It.IsAny<Func<JsonDocument, string, IEnumerable<string?>>>(),
                "sns",
                It.IsAny<string>()))
            .Callback<JsonDocument, Func<JsonDocument, string, IEnumerable<string?>>, string, string>(
                (doc, _, _, _) => capturedDocument = doc)
            .Returns(_extractedContext.Object);

        _tracingProvider.Setup(t => t.StartActiveSpan(
                It.IsAny<string>(),
                It.IsAny<ISpanContext?>()))
            .Returns(_scope.Object);

        _orderWorkflow.Setup(w => w.StockReservationFailed(It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        var sqsEvent = CreateSqsEventWithReservationFailedMessage("stock.reservation_failed");

        await _sut.HandleReservationFailed(sqsEvent);

        capturedDocument.Should().NotBeNull();
        capturedDocument!.RootElement.TryGetProperty("detail", out _)
            .Should().BeTrue("context extraction must receive the full SQS body with the detail key so GetHeader can find _datadog");
    }

    private static SQSEvent CreateSqsEventWithStockReservedMessage(string eventType)
    {
        var messageBody = JsonSerializer.Serialize(new
        {
            detail = new
            {
                id = Guid.NewGuid().ToString(),
                type = eventType,
                traceparent = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
                data = new
                {
                    orderNumber = "ORD-001",
                    productId = "PROD-001",
                    conversationId = "conv-001"
                },
                _datadog = new Dictionary<string, string>
                {
                    ["x-datadog-trace-id"] = "12345",
                    ["x-datadog-parent-id"] = "67890"
                }
            }
        });

        return new SQSEvent
        {
            Records = new List<SQSEvent.SQSMessage>
            {
                new()
                {
                    MessageId = "msg-001",
                    Body = messageBody
                }
            }
        };
    }

    private static SQSEvent CreateSqsEventWithReservationFailedMessage(string eventType)
    {
        var messageBody = JsonSerializer.Serialize(new
        {
            detail = new
            {
                id = Guid.NewGuid().ToString(),
                type = eventType,
                traceparent = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
                data = new
                {
                    orderNumber = "ORD-002",
                    productId = "PROD-002",
                    conversationId = "conv-002"
                },
                _datadog = new Dictionary<string, string>
                {
                    ["x-datadog-trace-id"] = "12345",
                    ["x-datadog-parent-id"] = "67890"
                }
            }
        });

        return new SQSEvent
        {
            Records = new List<SQSEvent.SQSMessage>
            {
                new()
                {
                    MessageId = "msg-002",
                    Body = messageBody
                }
            }
        };
    }
}
