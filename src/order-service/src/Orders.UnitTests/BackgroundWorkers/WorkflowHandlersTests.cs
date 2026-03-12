// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Text.Json;
using Datadog.Trace;
using Microsoft.Extensions.Logging;
using Orders.BackgroundWorkers;
using Orders.Core;
using Orders.Core.StockReservationFailure;
using Orders.Core.StockReservationSuccess;

namespace Orders.UnitTests.BackgroundWorkers;

public class WorkflowHandlersTests
{
    private readonly Mock<ITracingProvider> _tracingProvider;
    private readonly Mock<IOrderWorkflow> _orderWorkflow;
    private readonly Mock<IScope> _scope;
    private readonly Mock<ISpan> _span;
    private readonly Mock<ISpanContext> _extractedContext;

    public WorkflowHandlersTests()
    {
        _tracingProvider = new Mock<ITracingProvider>();
        _orderWorkflow = new Mock<IOrderWorkflow>();
        _scope = new Mock<IScope>();
        _span = new Mock<ISpan>();
        _extractedContext = new Mock<ISpanContext>();

        _scope.Setup(s => s.Span).Returns(_span.Object);
        _tracingProvider.Setup(t => t.StartActiveSpan(It.IsAny<string>(), It.IsAny<ISpanContext?>()))
            .Returns(_scope.Object);
    }

    [Fact]
    public async Task ReservationSuccess_WithDatadogContext_ExtractsAndUsesContextAsParent()
    {
        var requestWithContext = new StockReservationSuccess
        {
            UserId = "user-1",
            OrderNumber = "ORD-001",
            Datadog = new Dictionary<string, string>
            {
                ["x-datadog-trace-id"] = "12345",
                ["x-datadog-parent-id"] = "67890"
            }
        };

        _tracingProvider.Setup(t => t.ExtractContextIncludingDsm(
                It.IsAny<JsonDocument>(),
                It.IsAny<Func<JsonDocument, string, IEnumerable<string?>>>(),
                It.IsAny<string>(),
                It.IsAny<string>()))
            .Returns(_extractedContext.Object);

        _orderWorkflow.Setup(w => w.StockReservationSuccessful(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var successHandler = new StockReservationSuccessHandler(
            Mock.Of<IOrders>(), Mock.Of<Orders.Core.PublicEvents.IPublicEventPublisher>());
        var failureHandler = new StockReservationFailureHandler(
            Mock.Of<IOrders>());

        var sut = new WorkflowHandlers(successHandler, failureHandler, _tracingProvider.Object);

        await sut.ReservationSuccess(requestWithContext);

        _tracingProvider.Verify(t => t.ExtractContextIncludingDsm(
            It.IsAny<JsonDocument>(),
            It.IsAny<Func<JsonDocument, string, IEnumerable<string?>>>(),
            It.IsAny<string>(),
            It.IsAny<string>()), Times.Once);
        _tracingProvider.Verify(t => t.StartActiveSpan(
            It.Is<string>(operationName => operationName.Contains("orders.confirmOrder")),
            _extractedContext.Object), Times.Once);
    }

    [Fact]
    public async Task ReservationFailed_WithDatadogContext_ExtractsAndUsesContextAsParent()
    {
        var requestWithContext = new StockReservationFailure
        {
            UserId = "user-1",
            OrderNumber = "ORD-001",
            Datadog = new Dictionary<string, string>
            {
                ["x-datadog-trace-id"] = "12345",
                ["x-datadog-parent-id"] = "67890"
            }
        };

        _tracingProvider.Setup(t => t.ExtractContextIncludingDsm(
                It.IsAny<JsonDocument>(),
                It.IsAny<Func<JsonDocument, string, IEnumerable<string?>>>(),
                It.IsAny<string>(),
                It.IsAny<string>()))
            .Returns(_extractedContext.Object);

        _orderWorkflow.Setup(w => w.StockReservationFailed(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var successHandler = new StockReservationSuccessHandler(
            Mock.Of<IOrders>(), Mock.Of<Orders.Core.PublicEvents.IPublicEventPublisher>());
        var failureHandler = new StockReservationFailureHandler(
            Mock.Of<IOrders>());

        var sut = new WorkflowHandlers(successHandler, failureHandler, _tracingProvider.Object);

        await sut.ReservationFailed(requestWithContext);

        _tracingProvider.Verify(t => t.ExtractContextIncludingDsm(
            It.IsAny<JsonDocument>(),
            It.IsAny<Func<JsonDocument, string, IEnumerable<string?>>>(),
            It.IsAny<string>(),
            It.IsAny<string>()), Times.Once);
        _tracingProvider.Verify(t => t.StartActiveSpan(
            It.Is<string>(operationName => operationName.Contains("orders.noStock")),
            _extractedContext.Object), Times.Once);
    }
}
