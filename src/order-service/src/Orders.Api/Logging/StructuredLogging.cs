// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Diagnostics;

namespace Orders.Api.Logging;

/// <summary>
/// Structured logging context for order operations - NO PII/SENSITIVE DATA
/// </summary>
public readonly record struct OrderOperationContext
{
    /// <summary>
    /// Gets the correlation ID for request tracking
    /// </summary>
    public string CorrelationId { get; init; }
    
    /// <summary>
    /// Gets the operation name being performed
    /// </summary>
    public string Operation { get; init; }
    
    /// <summary>
    /// Gets the number of products in the order (for metrics only)
    /// </summary>
    public int? ProductCount { get; init; }
    
    /// <summary>
    /// Gets the order type (Standard, Priority, etc.)
    /// </summary>
    public string? OrderType { get; init; }
    
    /// <summary>
    /// Gets the user type (PREMIUM, STANDARD, ADMIN) for authorization context
    /// </summary>
    public string? UserType { get; init; }
    
    /// <summary>
    /// Gets the execution duration in milliseconds
    /// </summary>
    public long? DurationMs { get; init; }
    
    /// <summary>
    /// Gets the HTTP status code result
    /// </summary>
    public int? StatusCode { get; init; }
    
    /// <summary>
    /// Gets whether the operation was successful
    /// </summary>
    public bool? Success { get; init; }
    
    /// <summary>
    /// Gets the validation error count (if any)
    /// </summary>
    public int? ValidationErrorCount { get; init; }
    
    /// <summary>
    /// Gets the error category for failures
    /// </summary>
    public string? ErrorCategory { get; init; }
}

/// <summary>
/// Structured logging context for pagination operations
/// </summary>
public readonly record struct PaginationContext
{
    /// <summary>
    /// Gets the correlation ID for request tracking
    /// </summary>
    public string CorrelationId { get; init; }
    
    /// <summary>
    /// Gets the requested page size
    /// </summary>
    public int PageSize { get; init; }
    
    /// <summary>
    /// Gets the number of items returned
    /// </summary>
    public int ItemsReturned { get; init; }
    
    /// <summary>
    /// Gets whether there are more pages available
    /// </summary>
    public bool HasMorePages { get; init; }
    
    /// <summary>
    /// Gets the operation being paginated
    /// </summary>
    public string Operation { get; init; }
    
    /// <summary>
    /// Gets the execution duration in milliseconds
    /// </summary>
    public long DurationMs { get; init; }
}

/// <summary>
/// Performance metrics context for operations
/// </summary>
public readonly record struct PerformanceContext
{
    /// <summary>
    /// Gets the correlation ID for request tracking
    /// </summary>
    public string CorrelationId { get; init; }
    
    /// <summary>
    /// Gets the operation name
    /// </summary>
    public string Operation { get; init; }
    
    /// <summary>
    /// Gets the execution duration in milliseconds
    /// </summary>
    public long DurationMs { get; init; }
    
    /// <summary>
    /// Gets the database query count
    /// </summary>
    public int? DatabaseQueries { get; init; }
    
    /// <summary>
    /// Gets the external service call count
    /// </summary>
    public int? ExternalCalls { get; init; }
    
    /// <summary>
    /// Gets whether the operation succeeded
    /// </summary>
    public bool Success { get; init; }
    
    /// <summary>
    /// Gets memory usage in bytes
    /// </summary>
    public long? MemoryUsageBytes { get; init; }
}

/// <summary>
/// Business metrics context for order lifecycle tracking
/// </summary>
public readonly record struct BusinessMetricsContext
{
    /// <summary>
    /// Gets the correlation ID for request tracking
    /// </summary>
    public string CorrelationId { get; init; }
    
    /// <summary>
    /// Gets the business event type
    /// </summary>
    public string EventType { get; init; }
    
    /// <summary>
    /// Gets the order type for business analysis
    /// </summary>
    public string? OrderType { get; init; }
    
    /// <summary>
    /// Gets the user tier for segmentation analysis
    /// </summary>
    public string? UserTier { get; init; }
    
    /// <summary>
    /// Gets the product count for basket analysis
    /// </summary>
    public int? ProductCount { get; init; }
    
    /// <summary>
    /// Gets the timestamp for temporal analysis
    /// </summary>
    public DateTime Timestamp { get; init; }
    
    /// <summary>
    /// Gets the processing stage for funnel analysis
    /// </summary>
    public string? ProcessingStage { get; init; }
}

/// <summary>
/// Extensions for structured logging that ensure no PII is logged
/// </summary>
public static class StructuredLoggingExtensions
{
    /// <summary>
    /// Logs order operation with structured context - NO PII
    /// </summary>
    public static void LogOrderOperation(
        this ILogger logger, 
        LogLevel level,
        string message,
        OrderOperationContext context,
        Exception? exception = null)
    {
        using var scope = logger.BeginScope(new Dictionary<string, object>
        {
            ["CorrelationId"] = context.CorrelationId,
            ["Operation"] = context.Operation,
            ["ProductCount"] = context.ProductCount ?? 0,
            ["OrderType"] = context.OrderType ?? "Unknown",
            ["UserType"] = context.UserType ?? "Unknown",
            ["DurationMs"] = context.DurationMs ?? 0,
            ["StatusCode"] = context.StatusCode ?? 0,
            ["Success"] = context.Success ?? false,
            ["ValidationErrorCount"] = context.ValidationErrorCount ?? 0,
            ["ErrorCategory"] = context.ErrorCategory ?? "None"
        });

        logger.Log(level, exception, message);
    }

    /// <summary>
    /// Logs pagination operation with structured context
    /// </summary>
    public static void LogPaginationOperation(
        this ILogger logger,
        string message,
        PaginationContext context)
    {
        using var scope = logger.BeginScope(new Dictionary<string, object>
        {
            ["CorrelationId"] = context.CorrelationId,
            ["Operation"] = context.Operation,
            ["PageSize"] = context.PageSize,
            ["ItemsReturned"] = context.ItemsReturned,
            ["HasMorePages"] = context.HasMorePages,
            ["DurationMs"] = context.DurationMs
        });

        logger.LogInformation(message);
    }

    /// <summary>
    /// Logs performance metrics with structured context
    /// </summary>
    public static void LogPerformanceMetrics(
        this ILogger logger,
        string message,
        PerformanceContext context)
    {
        using var scope = logger.BeginScope(new Dictionary<string, object>
        {
            ["CorrelationId"] = context.CorrelationId,
            ["Operation"] = context.Operation,
            ["DurationMs"] = context.DurationMs,
            ["DatabaseQueries"] = context.DatabaseQueries ?? 0,
            ["ExternalCalls"] = context.ExternalCalls ?? 0,
            ["Success"] = context.Success,
            ["MemoryUsageBytes"] = context.MemoryUsageBytes ?? 0
        });

        logger.LogInformation(message);
    }

    /// <summary>
    /// Logs business metrics with structured context - NO PII
    /// </summary>
    public static void LogBusinessMetrics(
        this ILogger logger,
        string message,
        BusinessMetricsContext context)
    {
        using var scope = logger.BeginScope(new Dictionary<string, object>
        {
            ["CorrelationId"] = context.CorrelationId,
            ["EventType"] = context.EventType,
            ["OrderType"] = context.OrderType ?? "Unknown",
            ["UserTier"] = context.UserTier ?? "Unknown",
            ["ProductCount"] = context.ProductCount ?? 0,
            ["Timestamp"] = context.Timestamp,
            ["ProcessingStage"] = context.ProcessingStage ?? "Unknown"
        });

        logger.LogInformation(message);
    }

    /// <summary>
    /// Creates a performance tracking scope that automatically logs metrics
    /// </summary>
    public static IDisposable BeginPerformanceScope(
        this ILogger logger,
        string operation,
        string correlationId)
    {
        return new PerformanceScope(logger, operation, correlationId);
    }
}

/// <summary>
/// Performance tracking scope that automatically measures and logs execution time
/// </summary>
internal sealed class PerformanceScope : IDisposable
{
    private readonly ILogger _logger;
    private readonly string _operation;
    private readonly string _correlationId;
    private readonly Stopwatch _stopwatch;
    private readonly long _startMemory;
    private bool _disposed;

    public PerformanceScope(ILogger logger, string operation, string correlationId)
    {
        _logger = logger;
        _operation = operation;
        _correlationId = correlationId;
        _stopwatch = Stopwatch.StartNew();
        _startMemory = GC.GetTotalMemory(false);
    }

    public void Dispose()
    {
        if (_disposed) return;
        
        _stopwatch.Stop();
        var endMemory = GC.GetTotalMemory(false);
        var memoryDelta = endMemory - _startMemory;

        var context = new PerformanceContext
        {
            CorrelationId = _correlationId,
            Operation = _operation,
            DurationMs = _stopwatch.ElapsedMilliseconds,
            Success = true, // Assume success unless explicitly marked otherwise
            MemoryUsageBytes = memoryDelta
        };

        _logger.LogPerformanceMetrics($"Operation {_operation} completed", context);
        _disposed = true;
    }
}