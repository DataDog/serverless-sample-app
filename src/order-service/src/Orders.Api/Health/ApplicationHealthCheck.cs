// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.Extensions.Diagnostics.HealthChecks;
using Orders.Api.Logging;
using Orders.Core;
using FluentValidation;
using Orders.Api.Models;

namespace Orders.Api.Health;

/// <summary>
/// Health check for application-specific functionality and dependencies
/// </summary>
public class ApplicationHealthCheck : IHealthCheck
{
    private readonly IOrders _orders;
    private readonly IValidator<CreateOrderRequest> _validator;
    private readonly ILogger<ApplicationHealthCheck> _logger;

    public ApplicationHealthCheck(
        IOrders orders,
        IValidator<CreateOrderRequest> validator,
        ILogger<ApplicationHealthCheck> logger)
    {
        _orders = orders ?? throw new ArgumentNullException(nameof(orders));
        _validator = validator ?? throw new ArgumentNullException(nameof(validator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var correlationId = Guid.NewGuid().ToString();
        var healthData = new Dictionary<string, object>
        {
            ["CheckTimestamp"] = DateTime.UtcNow,
            ["CorrelationId"] = correlationId
        };
        
        try
        {
            _logger.LogInformation("Starting application health check with correlation {CorrelationId}", correlationId);
            
            // Test validation system
            var validationTestPassed = await TestValidationSystemAsync(healthData, cancellationToken);
            if (!validationTestPassed)
            {
                return HealthCheckResult.Unhealthy("Validation system is not functioning correctly", data: healthData);
            }

            // Test basic repository connectivity (without accessing actual data)
            var repositoryTestPassed = await TestRepositoryConnectivityAsync(healthData, cancellationToken);
            if (!repositoryTestPassed)
            {
                return HealthCheckResult.Degraded("Repository connectivity issues detected", data: healthData);
            }

            healthData["AllTestsPassed"] = true;
            _logger.LogHealthCheckPassed();
            
            return HealthCheckResult.Healthy("All application components are functioning correctly", data: healthData);
        }
        catch (Exception ex)
        {
            _logger.LogHealthCheckFailed("Application", ex);
            healthData["Exception"] = ex.Message;
            return HealthCheckResult.Unhealthy("Application health check failed", ex, healthData);
        }
    }

    private async Task<bool> TestValidationSystemAsync(Dictionary<string, object> healthData, CancellationToken cancellationToken)
    {
        try
        {
            // Test validation with a valid request
            var validRequest = new CreateOrderRequest
            {
                Products = new[] { "test-product-1", "test-product-2" }
            };
            
            var validResult = await _validator.ValidateAsync(validRequest, cancellationToken);
            
            // Test validation with an invalid request
            var invalidRequest = new CreateOrderRequest
            {
                Products = Array.Empty<string>() // Should fail validation
            };
            
            var invalidResult = await _validator.ValidateAsync(invalidRequest, cancellationToken);
            
            var validationWorks = validResult.IsValid && !invalidResult.IsValid;
            
            healthData["ValidationTestPassed"] = validationWorks;
            healthData["ValidRequestResult"] = validResult.IsValid;
            healthData["InvalidRequestResult"] = invalidResult.IsValid;
            healthData["InvalidRequestErrors"] = invalidResult.Errors.Count;
            
            if (!validationWorks)
            {
                _logger.LogWarning("Validation system test failed: valid={ValidResult}, invalid={InvalidResult}", 
                    validResult.IsValid, invalidResult.IsValid);
            }
            
            return validationWorks;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Validation system test failed with exception");
            healthData["ValidationTestPassed"] = false;
            healthData["ValidationTestError"] = ex.Message;
            return false;
        }
    }

    private async Task<bool> TestRepositoryConnectivityAsync(Dictionary<string, object> healthData, CancellationToken cancellationToken)
    {
        try
        {
            // Test pagination functionality with minimal data request
            var pagination = new Orders.Core.Common.PaginationRequest(1, null); // Request only 1 item
            
            // Try to get orders for a test user (this tests basic connectivity without exposing real data)
            var testUserId = "health-check-test-user-" + Guid.NewGuid().ToString("N")[..8];
            var result = await _orders.ForUser(testUserId, pagination, cancellationToken);
            
            // Should succeed even if no orders found (empty result is valid)
            var repositoryWorks = result != null;
            
            healthData["RepositoryTestPassed"] = repositoryWorks;
            healthData["RepositoryReturnedItems"] = result?.ItemCount ?? -1;
            healthData["RepositoryPageSize"] = result?.PageSize ?? -1;
            
            if (!repositoryWorks)
            {
                _logger.LogWarning("Repository connectivity test failed");
            }
            
            return repositoryWorks;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Repository connectivity test failed with exception");
            healthData["RepositoryTestPassed"] = false;
            healthData["RepositoryTestError"] = ex.Message;
            return false;
        }
    }
}