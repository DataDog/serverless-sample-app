// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace Orders.Core.PublicEvents;

public record OrderCreatedEventV1
{
    public string OrderNumber { get; set; } = "";

    public string[] Products { get; set; } = [];

    public string UserId { get; set; } = "";
}