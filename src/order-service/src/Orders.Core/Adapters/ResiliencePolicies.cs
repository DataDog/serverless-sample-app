// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Microsoft.Extensions.Logging;
using Polly;
using Polly.CircuitBreaker;
using Polly.Registry;
using Polly.Retry;
using Polly.Timeout;

namespace Orders.Core.Adapters;

public static class ResiliencePolicies
{
    private const int MAX_RETRY_ATTEMPTS = 3;
    public static ResiliencePipeline<T> GetDynamoDBPolicy<T>(ILogger logger)
    {
        return new ResiliencePipelineBuilder<T>()
            .AddRetry(new RetryStrategyOptions<T>
            {
                ShouldHandle = new PredicateBuilder<T>()
                    .Handle<Amazon.DynamoDBv2.Model.ProvisionedThroughputExceededException>()
                    .Handle<Amazon.DynamoDBv2.AmazonDynamoDBException>(),
                MaxRetryAttempts = MAX_RETRY_ATTEMPTS,
                BackoffType = DelayBackoffType.Exponential,
                Delay = TimeSpan.FromMilliseconds(200),
                OnRetry = args =>
                {
                    logger.LogWarning(args.Outcome.Exception, 
                        "DynamoDB operation failed. Retrying {RetryCount}/{MaxRetryCount}", 
                        args.AttemptNumber, MAX_RETRY_ATTEMPTS);
                    return ValueTask.CompletedTask;
                }
            })
            .AddCircuitBreaker(new CircuitBreakerStrategyOptions<T>
            {
                FailureRatio = 0.5,
                SamplingDuration = TimeSpan.FromSeconds(30),
                MinimumThroughput = 8,
                BreakDuration = TimeSpan.FromSeconds(5),
                OnOpened = args =>
                {
                    logger.LogError("DynamoDB circuit breaker opened at {TimestampUtc}", args.BreakDuration);
                    return ValueTask.CompletedTask;
                },
                OnClosed = args =>
                {
                    logger.LogInformation("DynamoDB circuit breaker closed");
                    return ValueTask.CompletedTask;
                }
            })
            .AddTimeout(TimeSpan.FromSeconds(5))
            .Build();
    }

    public static ResiliencePipeline<T> GetStepFunctionsPolicy<T>(ILogger logger)
    {
        return new ResiliencePipelineBuilder<T>()
            .AddRetry(new RetryStrategyOptions<T>
            {
                ShouldHandle = new PredicateBuilder<T>()
                    .Handle<Amazon.StepFunctions.AmazonStepFunctionsException>(),
                MaxRetryAttempts = MAX_RETRY_ATTEMPTS,
                BackoffType = DelayBackoffType.Exponential,
                Delay = TimeSpan.FromMilliseconds(300),
                OnRetry = args =>
                {
                    logger.LogWarning(args.Outcome.Exception, 
                        "StepFunctions operation failed. Retrying {RetryCount}/{MaxRetryCount}", 
                        args.AttemptNumber, MAX_RETRY_ATTEMPTS);
                    return ValueTask.CompletedTask;
                }
            })
            .AddCircuitBreaker(new CircuitBreakerStrategyOptions<T>
            {
                FailureRatio = 0.5,
                SamplingDuration = TimeSpan.FromSeconds(30),
                MinimumThroughput = 5,
                BreakDuration = TimeSpan.FromSeconds(5),
                OnOpened = args =>
                {
                    logger.LogError("StepFunctions circuit breaker opened at {TimestampUtc}", args.BreakDuration);
                    return ValueTask.CompletedTask;
                },
                OnClosed = args =>
                {
                    logger.LogInformation("StepFunctions circuit breaker closed");
                    return ValueTask.CompletedTask;
                }
            })
            .AddTimeout(TimeSpan.FromSeconds(5))
            .Build();
    }
} 