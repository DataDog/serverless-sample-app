// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

namespace TestHarness.Lambda;

public interface IEventStore
{
    Task Store(ReceivedEvent evt);

    Task<List<ReceivedEvent>> EventsFor(string key);
}