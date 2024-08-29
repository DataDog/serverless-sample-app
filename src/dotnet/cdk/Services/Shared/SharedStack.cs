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