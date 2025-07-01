// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using System.Diagnostics.Metrics;

namespace Orders.Api.RateLimiting;

/// <summary>
/// Metrics collection for rate limiting operations - NO PII data
/// </summary>
public class RateLimitingMetrics
{
    private readonly Counter<int> _requestsAllowed;
    private readonly Counter<int> _requestsRejected;
    private readonly Histogram<double> _queueTime;
    private readonly Counter<int> _requestsByUserType;

    public RateLimitingMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create("Orders.RateLimiting");
        
        _requestsAllowed = meter.CreateCounter<int>(
            "rate_limit_requests_allowed_total",
            "Total number of requests allowed by rate limiter");
            
        _requestsRejected = meter.CreateCounter<int>(
            "rate_limit_requests_rejected_total", 
            "Total number of requests rejected by rate limiter");
            
        _queueTime = meter.CreateHistogram<double>(
            "rate_limit_queue_duration_seconds",
            "Time spent waiting in rate limiter queue");
            
        _requestsByUserType = meter.CreateCounter<int>(
            "rate_limit_requests_by_user_type_total",
            "Total requests categorized by user type (no PII)");
    }

    /// <summary>
    /// Records a request that was allowed by the rate limiter
    /// </summary>
    public void RecordAllowed(string policy, string userType, string endpoint)
    {
        _requestsAllowed.Add(1, 
            new KeyValuePair<string, object?>("policy", policy),
            new KeyValuePair<string, object?>("user_type", userType),
            new KeyValuePair<string, object?>("endpoint", endpoint));
    }

    /// <summary>
    /// Records a request that was rejected by the rate limiter
    /// </summary>
    public void RecordRejected(string policy, string userType, string endpoint)
    {
        _requestsRejected.Add(1,
            new KeyValuePair<string, object?>("policy", policy),
            new KeyValuePair<string, object?>("user_type", userType),
            new KeyValuePair<string, object?>("endpoint", endpoint));
    }

    /// <summary>
    /// Records time spent waiting in the rate limiter queue
    /// </summary>
    public void RecordQueueTime(double queueTimeSeconds, string policy, string userType)
    {
        _queueTime.Record(queueTimeSeconds,
            new KeyValuePair<string, object?>("policy", policy),
            new KeyValuePair<string, object?>("user_type", userType));
    }

    /// <summary>
    /// Records request counts by user type for analytics (NO PII)
    /// </summary>
    public void RecordRequestByUserType(string userType, string operation)
    {
        _requestsByUserType.Add(1,
            new KeyValuePair<string, object?>("user_type", userType),
            new KeyValuePair<string, object?>("operation", operation));
    }
}