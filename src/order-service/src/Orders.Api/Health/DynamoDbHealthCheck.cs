// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Orders.Api.Logging;

namespace Orders.Api.Health;

/// <summary>
/// Health check for DynamoDB connectivity and table status
/// </summary>
public class DynamoDbHealthCheck : IHealthCheck
{
    private readonly AmazonDynamoDBClient _dynamoDbClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DynamoDbHealthCheck> _logger;

    public DynamoDbHealthCheck(
        AmazonDynamoDBClient dynamoDbClient,
        IConfiguration configuration,
        ILogger<DynamoDbHealthCheck> logger)
    {
        _dynamoDbClient = dynamoDbClient ?? throw new ArgumentNullException(nameof(dynamoDbClient));
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString();
        
        try
        {
            _logger.LogInformation("Starting DynamoDB health check with correlation {CorrelationId}", correlationId);
            
            var tableName = _configuration["TABLE_NAME"];
            if (string.IsNullOrEmpty(tableName))
            {
                const string message = "TABLE_NAME configuration is missing";
                _logger.LogError("DynamoDB health check failed: {Message}", message);
                return HealthCheckResult.Unhealthy(message);
            }

            var describeRequest = new DescribeTableRequest 
            { 
                TableName = tableName 
            };
            
            var response = await _dynamoDbClient.DescribeTableAsync(describeRequest, cancellationToken);
            
            var healthData = new Dictionary<string, object>
            {
                ["TableName"] = tableName,
                ["TableStatus"] = response.Table.TableStatus.ToString(),
                ["ItemCount"] = response.Table.ItemCount,
                ["TableSizeBytes"] = response.Table.TableSizeBytes,
                ["ReadCapacityUnits"] = response.Table.ProvisionedThroughput?.ReadCapacityUnits ?? 0,
                ["WriteCapacityUnits"] = response.Table.ProvisionedThroughput?.WriteCapacityUnits ?? 0,
                ["CheckTimestamp"] = DateTime.UtcNow,
                ["CorrelationId"] = correlationId
            };

            if (response.Table.TableStatus == TableStatus.ACTIVE)
            {
                _logger.LogHealthCheckPassed();
                return HealthCheckResult.Healthy($"DynamoDB table '{tableName}' is active and healthy", data: healthData);
            }
            
            if (response.Table.TableStatus == TableStatus.UPDATING)
            {
                _logger.LogInformation("DynamoDB table {TableName} is updating - health degraded", tableName);
                return HealthCheckResult.Degraded($"DynamoDB table '{tableName}' is updating (status: {response.Table.TableStatus})", data: healthData);
            }
            
            _logger.LogWarning("DynamoDB table {TableName} has unhealthy status: {Status}", tableName, response.Table.TableStatus);
            return HealthCheckResult.Unhealthy($"DynamoDB table '{tableName}' is not active (status: {response.Table.TableStatus})", data: healthData);
        }
        catch (ResourceNotFoundException ex)
        {
            _logger.LogHealthCheckFailed("DynamoDB", ex);
            return HealthCheckResult.Unhealthy("DynamoDB table not found", ex);
        }
        catch (Exception ex)
        {
            _logger.LogHealthCheckFailed("DynamoDB", ex);
            return HealthCheckResult.Unhealthy("Cannot connect to DynamoDB", ex);
        }
    }
}