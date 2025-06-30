// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.Extensions.Diagnostics.HealthChecks;
using Orders.Api.Logging;

namespace Orders.Api.Health;

/// <summary>
/// Health check for memory usage and garbage collection metrics
/// </summary>
public class MemoryHealthCheck : IHealthCheck
{
    private const long MaxMemoryBytes = 500 * 1024 * 1024; // 500MB
    private const long WarningThresholdBytes = (long)(MaxMemoryBytes * 0.8); // 80% of max
    private readonly ILogger<MemoryHealthCheck> _logger;

    public MemoryHealthCheck(ILogger<MemoryHealthCheck> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString();
        
        try
        {
            _logger.LogInformation("Starting memory health check with correlation {CorrelationId}", correlationId);
            
            var allocatedBytes = GC.GetTotalMemory(false);
            var gen0Collections = GC.CollectionCount(0);
            var gen1Collections = GC.CollectionCount(1);
            var gen2Collections = GC.CollectionCount(2);
            
            // Calculate memory pressure indicators
            var memoryPressure = allocatedBytes / (double)MaxMemoryBytes;
            var totalCollections = gen0Collections + gen1Collections + gen2Collections;
            
            var healthData = new Dictionary<string, object>
            {
                ["AllocatedBytes"] = allocatedBytes,
                ["AllocatedMB"] = Math.Round(allocatedBytes / (1024.0 * 1024.0), 2),
                ["MaxBytes"] = MaxMemoryBytes,
                ["MaxMB"] = Math.Round(MaxMemoryBytes / (1024.0 * 1024.0), 2),
                ["MemoryPressurePercent"] = Math.Round(memoryPressure * 100, 1),
                ["Gen0Collections"] = gen0Collections,
                ["Gen1Collections"] = gen1Collections,
                ["Gen2Collections"] = gen2Collections,
                ["TotalCollections"] = totalCollections,
                ["CheckTimestamp"] = DateTime.UtcNow,
                ["CorrelationId"] = correlationId
            };

            // Force a memory measurement with garbage collection for more accurate reading
            if (allocatedBytes > WarningThresholdBytes)
            {
                _logger.LogInformation("Memory usage high, forcing garbage collection for accurate measurement");
                var beforeGC = allocatedBytes;
                GC.Collect();
                GC.WaitForPendingFinalizers();
                GC.Collect();
                var afterGC = GC.GetTotalMemory(false);
                
                healthData["AllocatedBytesBeforeGC"] = beforeGC;
                healthData["AllocatedBytesAfterGC"] = afterGC;
                healthData["BytesFreedByGC"] = beforeGC - afterGC;
                
                allocatedBytes = afterGC;
                memoryPressure = allocatedBytes / (double)MaxMemoryBytes;
                healthData["MemoryPressurePercentAfterGC"] = Math.Round(memoryPressure * 100, 1);
            }

            // Log performance metrics
            _logger.LogPerformanceMetrics(
                "MemoryHealthCheck",
                0, // Duration not relevant for this check
                allocatedBytes / 1024 // Convert to KB
            );

            if (allocatedBytes >= MaxMemoryBytes)
            {
                _logger.LogHealthCheckFailed("Memory", new InvalidOperationException($"Memory usage {allocatedBytes} bytes exceeds maximum {MaxMemoryBytes} bytes"));
                return Task.FromResult(HealthCheckResult.Unhealthy(
                    $"Memory usage {Math.Round(allocatedBytes / (1024.0 * 1024.0), 1)}MB exceeds limit of {Math.Round(MaxMemoryBytes / (1024.0 * 1024.0), 1)}MB",
                    data: healthData));
            }

            if (allocatedBytes >= WarningThresholdBytes)
            {
                _logger.LogPerformanceWarning("MemoryUsage", allocatedBytes / (1024 * 1024)); // MB
                return Task.FromResult(HealthCheckResult.Degraded(
                    $"Memory usage {Math.Round(allocatedBytes / (1024.0 * 1024.0), 1)}MB is approaching limit of {Math.Round(MaxMemoryBytes / (1024.0 * 1024.0), 1)}MB",
                    data: healthData));
            }

            // Check for excessive garbage collection activity (potential memory pressure)
            if (gen2Collections > 10 && gen2Collections > gen1Collections * 0.1)
            {
                _logger.LogWarning("High Gen2 garbage collection activity detected: {Gen2Collections} collections", gen2Collections);
                return Task.FromResult(HealthCheckResult.Degraded(
                    $"High garbage collection activity detected - Gen2: {gen2Collections} collections may indicate memory pressure",
                    data: healthData));
            }

            _logger.LogHealthCheckPassed();
            return Task.FromResult(HealthCheckResult.Healthy(
                $"Memory usage {Math.Round(allocatedBytes / (1024.0 * 1024.0), 1)}MB is within normal limits",
                healthData));
        }
        catch (Exception ex)
        {
            _logger.LogHealthCheckFailed("Memory", ex);
            return Task.FromResult(HealthCheckResult.Unhealthy("Memory health check failed", ex));
        }
    }
}