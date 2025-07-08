// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.Core.Common;

/// <summary>
/// Represents the result of an operation that can either succeed or fail
/// </summary>
public abstract record Result<T>
{
    public abstract bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;
}

/// <summary>
/// Represents a successful result with a value
/// </summary>
public sealed record Success<T>(T Value) : Result<T>
{
    public override bool IsSuccess => true;
}

/// <summary>
/// Represents a failed result with error information
/// </summary>
public sealed record Failure<T>(string ErrorCode, string ErrorMessage, Exception? Exception = null) : Result<T>
{
    public override bool IsSuccess => false;
}

/// <summary>
/// Extension methods for working with Result types
/// </summary>
public static class ResultExtensions
{
    public static Result<T> Success<T>(T value) => new Success<T>(value);
    
    public static Result<T> Failure<T>(string errorCode, string errorMessage, Exception? exception = null) => 
        new Failure<T>(errorCode, errorMessage, exception);

    public static Result<TResult> Map<T, TResult>(this Result<T> result, Func<T, TResult> mapper)
    {
        return result switch
        {
            Success<T> success => Success(mapper(success.Value)),
            Failure<T> failure => Failure<TResult>(failure.ErrorCode, failure.ErrorMessage, failure.Exception),
            _ => throw new InvalidOperationException("Unknown result type")
        };
    }

    public static async Task<Result<TResult>> MapAsync<T, TResult>(
        this Result<T> result, 
        Func<T, Task<TResult>> mapper)
    {
        return result switch
        {
            Success<T> success => Success(await mapper(success.Value)),
            Failure<T> failure => Failure<TResult>(failure.ErrorCode, failure.ErrorMessage, failure.Exception),
            _ => throw new InvalidOperationException("Unknown result type")
        };
    }

    public static Result<TResult> FlatMap<T, TResult>(this Result<T> result, Func<T, Result<TResult>> mapper)
    {
        return result switch
        {
            Success<T> success => mapper(success.Value),
            Failure<T> failure => Failure<TResult>(failure.ErrorCode, failure.ErrorMessage, failure.Exception),
            _ => throw new InvalidOperationException("Unknown result type")
        };
    }

    public static async Task<Result<TResult>> FlatMapAsync<T, TResult>(
        this Result<T> result, 
        Func<T, Task<Result<TResult>>> mapper)
    {
        return result switch
        {
            Success<T> success => await mapper(success.Value),
            Failure<T> failure => Failure<TResult>(failure.ErrorCode, failure.ErrorMessage, failure.Exception),
            _ => throw new InvalidOperationException("Unknown result type")
        };
    }
}