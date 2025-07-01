// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.Extensions.Logging;

namespace Orders.Api.Logging;

/// <summary>
/// High-performance logging message definitions using source generators - NO PII/SENSITIVE DATA
/// </summary>
public static partial class LogMessages
{
    // Order Creation Events
    [LoggerMessage(
        EventId = 1001,
        Level = LogLevel.Information,
        Message = "Order creation started with {ProductCount} products for user type {UserType}")]
    public static partial void LogOrderCreationStarted(
        this ILogger logger, 
        int productCount, 
        string userType);

    [LoggerMessage(
        EventId = 1002,
        Level = LogLevel.Information,
        Message = "Order created successfully with type {OrderType} in {DurationMs}ms")]
    public static partial void LogOrderCreated(
        this ILogger logger, 
        string orderType, 
        long durationMs);

    [LoggerMessage(
        EventId = 1003,
        Level = LogLevel.Warning,
        Message = "Order creation failed due to validation errors: {ValidationErrorCount} errors found")]
    public static partial void LogOrderCreationValidationFailed(
        this ILogger logger, 
        int validationErrorCount);

    [LoggerMessage(
        EventId = 1004,
        Level = LogLevel.Error,
        Message = "Order creation failed unexpectedly for user type {UserType}")]
    public static partial void LogOrderCreationFailed(
        this ILogger logger, 
        string userType, 
        Exception exception);

    // Order Completion Events
    [LoggerMessage(
        EventId = 1010,
        Level = LogLevel.Information,
        Message = "Order completion started by admin user type {UserType}")]
    public static partial void LogOrderCompletionStarted(
        this ILogger logger, 
        string userType);

    [LoggerMessage(
        EventId = 1011,
        Level = LogLevel.Information,
        Message = "Order completed successfully in {DurationMs}ms")]
    public static partial void LogOrderCompleted(
        this ILogger logger, 
        long durationMs);

    [LoggerMessage(
        EventId = 1012,
        Level = LogLevel.Warning,
        Message = "Order completion denied - user type {UserType} lacks admin privileges")]
    public static partial void LogOrderCompletionDenied(
        this ILogger logger, 
        string userType);

    [LoggerMessage(
        EventId = 1013,
        Level = LogLevel.Warning,
        Message = "Order completion failed - order not found or invalid state")]
    public static partial void LogOrderCompletionNotFound(
        this ILogger logger);

    // Order Retrieval Events
    [LoggerMessage(
        EventId = 1020,
        Level = LogLevel.Information,
        Message = "Order retrieval started for user type {UserType}")]
    public static partial void LogOrderRetrievalStarted(
        this ILogger logger, 
        string userType);

    [LoggerMessage(
        EventId = 1021,
        Level = LogLevel.Information,
        Message = "Order retrieved successfully in {DurationMs}ms")]
    public static partial void LogOrderRetrieved(
        this ILogger logger, 
        long durationMs);

    [LoggerMessage(
        EventId = 1022,
        Level = LogLevel.Warning,
        Message = "Order not found for retrieval request")]
    public static partial void LogOrderNotFound(
        this ILogger logger);

    // Pagination Events
    [LoggerMessage(
        EventId = 1030,
        Level = LogLevel.Information,
        Message = "Pagination query started: pageSize={PageSize}, operation={Operation}")]
    public static partial void LogPaginationStarted(
        this ILogger logger, 
        int pageSize, 
        string operation);

    [LoggerMessage(
        EventId = 1031,
        Level = LogLevel.Information,
        Message = "Pagination completed: returned {ItemCount} items, hasMore={HasMorePages}, duration={DurationMs}ms")]
    public static partial void LogPaginationCompleted(
        this ILogger logger, 
        int itemCount, 
        bool hasMorePages, 
        long durationMs);

    [LoggerMessage(
        EventId = 1032,
        Level = LogLevel.Warning,
        Message = "Pagination validation failed: pageSize={PageSize} exceeds maximum allowed")]
    public static partial void LogPaginationValidationFailed(
        this ILogger logger, 
        int pageSize);

    // Authentication & Authorization Events
    [LoggerMessage(
        EventId = 1040,
        Level = LogLevel.Warning,
        Message = "Authentication failed - missing or invalid user claims")]
    public static partial void LogAuthenticationFailed(
        this ILogger logger);

    [LoggerMessage(
        EventId = 1041,
        Level = LogLevel.Warning,
        Message = "Authorization failed - user type {UserType} attempted restricted operation {Operation}")]
    public static partial void LogAuthorizationFailed(
        this ILogger logger, 
        string userType, 
        string operation);

    [LoggerMessage(
        EventId = 1042,
        Level = LogLevel.Information,
        Message = "User authenticated successfully with type {UserType}")]
    public static partial void LogUserAuthenticated(
        this ILogger logger, 
        string userType);

    // Validation Events
    [LoggerMessage(
        EventId = 1050,
        Level = LogLevel.Warning,
        Message = "Input validation failed: {ErrorCount} validation errors in {Operation}")]
    public static partial void LogValidationFailed(
        this ILogger logger, 
        int errorCount, 
        string operation);

    [LoggerMessage(
        EventId = 1051,
        Level = LogLevel.Information,
        Message = "Input validation passed for {Operation} in {DurationMs}ms")]
    public static partial void LogValidationPassed(
        this ILogger logger, 
        string operation, 
        long durationMs);

    // Database & External Service Events
    [LoggerMessage(
        EventId = 1060,
        Level = LogLevel.Information,
        Message = "Database operation started: {Operation}")]
    public static partial void LogDatabaseOperationStarted(
        this ILogger logger, 
        string operation);

    [LoggerMessage(
        EventId = 1061,
        Level = LogLevel.Information,
        Message = "Database operation completed: {Operation} in {DurationMs}ms")]
    public static partial void LogDatabaseOperationCompleted(
        this ILogger logger, 
        string operation, 
        long durationMs);

    [LoggerMessage(
        EventId = 1062,
        Level = LogLevel.Warning,
        Message = "Database operation failed: {Operation} - will retry")]
    public static partial void LogDatabaseOperationRetry(
        this ILogger logger, 
        string operation, 
        Exception exception);

    [LoggerMessage(
        EventId = 1063,
        Level = LogLevel.Error,
        Message = "Database operation failed permanently: {Operation}")]
    public static partial void LogDatabaseOperationFailed(
        this ILogger logger, 
        string operation, 
        Exception exception);

    // Workflow Events
    [LoggerMessage(
        EventId = 1070,
        Level = LogLevel.Information,
        Message = "Workflow started: {WorkflowType} for order type {OrderType}")]
    public static partial void LogWorkflowStarted(
        this ILogger logger, 
        string workflowType, 
        string orderType);

    [LoggerMessage(
        EventId = 1071,
        Level = LogLevel.Information,
        Message = "Workflow completed: {WorkflowType} in {DurationMs}ms")]
    public static partial void LogWorkflowCompleted(
        this ILogger logger, 
        string workflowType, 
        long durationMs);

    [LoggerMessage(
        EventId = 1072,
        Level = LogLevel.Error,
        Message = "Workflow failed: {WorkflowType} for order type {OrderType}")]
    public static partial void LogWorkflowFailed(
        this ILogger logger, 
        string workflowType, 
        string orderType, 
        Exception exception);

    // Performance & Health Events
    [LoggerMessage(
        EventId = 1080,
        Level = LogLevel.Information,
        Message = "Performance metrics: {Operation} took {DurationMs}ms, memory delta: {MemoryDeltaKB}KB")]
    public static partial void LogPerformanceMetrics(
        this ILogger logger, 
        string operation, 
        long durationMs, 
        long memoryDeltaKB);

    [LoggerMessage(
        EventId = 1081,
        Level = LogLevel.Warning,
        Message = "Performance warning: {Operation} took {DurationMs}ms (exceeds threshold)")]
    public static partial void LogPerformanceWarning(
        this ILogger logger, 
        string operation, 
        long durationMs);

    [LoggerMessage(
        EventId = 1082,
        Level = LogLevel.Information,
        Message = "Health check completed: all systems operational")]
    public static partial void LogHealthCheckPassed(
        this ILogger logger);

    [LoggerMessage(
        EventId = 1083,
        Level = LogLevel.Error,
        Message = "Health check failed: {ComponentName} is unhealthy")]
    public static partial void LogHealthCheckFailed(
        this ILogger logger, 
        string componentName, 
        Exception exception);

    // Business Intelligence Events (NO PII - only aggregate data)
    [LoggerMessage(
        EventId = 1090,
        Level = LogLevel.Information,
        Message = "Business event: {EventType} for {OrderType} order with {ProductCount} products")]
    public static partial void LogBusinessEvent(
        this ILogger logger, 
        string eventType, 
        string orderType, 
        int productCount);

    [LoggerMessage(
        EventId = 1091,
        Level = LogLevel.Information,
        Message = "Order funnel stage: {Stage} reached for {OrderType} order")]
    public static partial void LogOrderFunnelStage(
        this ILogger logger, 
        string stage, 
        string orderType);

    [LoggerMessage(
        EventId = 1092,
        Level = LogLevel.Information,
        Message = "User segment activity: {UserTier} users performed {Operation}")]
    public static partial void LogUserSegmentActivity(
        this ILogger logger, 
        string userTier, 
        string operation);
}