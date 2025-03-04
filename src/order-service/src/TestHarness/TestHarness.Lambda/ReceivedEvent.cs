// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace TestHarness.Lambda;

public record ReceivedEvent(string Key, string EventData, string EventType, DateTime ReceivedOn, string ReceivedFrom, string? ConversationId = null)
{
    public string Key { get; set; } = Key;

    public string EventData { get; set; } = EventData;
    
    public string EventType { get; set; } = EventType;

    public DateTime ReceivedOn { get; set; } = ReceivedOn;

    public string ReceivedFrom { get; set; } = ReceivedFrom;
    
    public string ConversationId { get; set; } = ConversationId ?? "";
}