// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace Orders.IntegrationTests;

public record ReceivedEvent
{
    public string Key { get; set; } = "";

    public string EventData { get; set; } = "";
    
    public string EventType { get; set; } = "";

    public DateTime ReceivedOn { get; set; }

    public string ReceivedFrom { get; set; } = "";
    
    public string ConversationId { get; set; } = "";
}