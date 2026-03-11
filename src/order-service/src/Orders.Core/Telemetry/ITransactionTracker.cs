// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2026 Datadog, Inc.

namespace Orders.Core.Telemetry;

public interface ITransactionTracker
{
    Task TrackTransactionAsync(string transactionId, string checkpointName);
}