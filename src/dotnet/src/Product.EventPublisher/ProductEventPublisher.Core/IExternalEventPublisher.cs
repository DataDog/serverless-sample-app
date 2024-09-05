// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using ProductEventPublisher.Core.ExternalEvents;

namespace ProductEventPublisher.Core;

public interface IExternalEventPublisher
{
    Task Publish(ProductCreatedEventV1 evt);
    Task Publish(ProductUpdatedEventV1 evt);
    Task Publish(ProductDeletedEventV1 evt);
}