// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.IntegrationTests;

public record PagedResponse<T>
{
    public List<T> Items { get; set; }
    public int PageSize { get; set; }
    public bool HasMorePages { get; set; }
    public string NextPageToken { get; set; }
}