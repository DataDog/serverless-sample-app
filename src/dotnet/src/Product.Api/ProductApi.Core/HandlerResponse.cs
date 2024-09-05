// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Text.Json.Serialization;

namespace ProductApi.Core;

public record HandlerResponse<T>(T? Data, bool IsSuccess, List<string> Message)
{
    [JsonPropertyName("isSuccess")]
    public bool IsSuccess { get; init; } = IsSuccess;
    
    [JsonPropertyName("data")]
    public T? Data { get; init; } = Data;
    
    [JsonPropertyName("message")]
    public List<string> Message { get; init; } = Message;
}