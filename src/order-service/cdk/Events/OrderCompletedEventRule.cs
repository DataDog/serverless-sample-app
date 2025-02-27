// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2025 Datadog, Inc.

using Amazon.CDK.AWS.Events;
using Constructs;
using OrdersService.CDK.Constructs;

namespace OrdersService.CDK.Events;

public sealed class OrderCompletedEventRule : Rule
{
    public OrderCompletedEventRule(Construct scope, string id, SharedProps sharedProps, IRuleProps props = null) : base(scope, id, props)
    {
        AddEventPattern(new EventPattern()
        {
            DetailType = ["orders.orderCompleted.v1"],
            Source = [$"{sharedProps.Env}.orders"]
        });
    }
}