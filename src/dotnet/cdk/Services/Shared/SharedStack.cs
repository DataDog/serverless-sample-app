// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.CDK;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.SSM;
using Constructs;

namespace ServerlessGettingStarted.CDK.Services.Shared;

public class SharedStack : Stack {

    internal SharedStack(Construct scope, string id, IStackProps props = null) : base(scope, id, props)
    {
        var bus = new EventBus(this, "DotnetTracedBus");

        var busNameParameter = new StringParameter(this, "DotnetBusNameParameter", new StringParameterProps()
        {
            StringValue = bus.EventBusName,
            ParameterName = "/dotnet/shared/event-bus-name"
        });
    }
}