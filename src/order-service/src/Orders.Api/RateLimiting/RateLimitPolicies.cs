// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.Api.RateLimiting;

/// <summary>
/// Defines rate limiting policy names for different types of operations
/// </summary>
public static class RateLimitPolicies
{
    /// <summary>
    /// Default policy for anonymous users and fallback scenarios
    /// </summary>
    public const string Default = "DefaultPolicy";
    
    /// <summary>
    /// Enhanced limits for premium/authenticated users
    /// </summary>
    public const string Premium = "PremiumPolicy";
    
    /// <summary>
    /// Higher limits for read-only operations (GET requests)
    /// </summary>
    public const string ReadOnly = "ReadOnlyPolicy";
    
    /// <summary>
    /// Lower limits for write operations (POST, PUT, DELETE)
    /// </summary>
    public const string WriteOnly = "WriteOnlyPolicy";
    
    /// <summary>
    /// Strict limits for admin operations
    /// </summary>
    public const string AdminOperations = "AdminOperationsPolicy";
}