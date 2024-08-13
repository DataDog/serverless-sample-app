using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.Events;
using Amazon.CDK.AWS.Events.Targets;
using Amazon.CDK.AWS.Lambda;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.Logs;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SQS;
using Amazon.CDK.AWS.StepFunctions;
using Constructs;
using LogGroupProps = Amazon.CDK.AWS.Logs.LogGroupProps;

namespace DotnetLambdaHybridTracing;

public record BackgroundWorkerProps(string ServiceName, string Env, string Version, ISecret DdApiKeySecret, IEventBus SharedEventBus);

public class BackgroundWorker : Construct
{
    public IFunction SnsConsumerFunction { get; private set; }
    
    public IQueue SnsConsumerQueue { get; private set; }
    public IFunction SnsToSqsConsumerFunction { get; private set; }
    
    public IQueue EventBridgeConsumerQueue { get; private set; }
    public IFunction EventBridgeToSqsConsumerFunction { get; private set; }
    
    public IFunction EventBridgeConsumerFunction { get; private set; }
    
    public IFunction StepFunctionsHandlerFunction { get; private set; }
    
    public StateMachine Workflow { get; private set; }
    
    public BackgroundWorker(Construct scope, string id, BackgroundWorkerProps props) : base(scope, id)
    {
        AddStepFunctions(props);
        AddSnsConsumer(props);
        AddSnsToSqsConsumer(props);
        AddEventBridgeToSqsConsumer(props);
        AddEventBridgeConsumer(props);

        this.Workflow.GrantStartExecution(this.EventBridgeToSqsConsumerFunction);
    }

    private void AddStepFunctions(BackgroundWorkerProps props)
    {
        StepFunctionsHandlerFunction = new InstrumentedFunction(this, "StepFunctionsHandler",
            new FunctionProps(props.ServiceName, props.Env, props.Version, "StepFunctionsHandler", "./functions/background-worker/",
                "BackgroundWorkers::BackgroundWorkers.Functions_StepFunctionsHandler_Generated::StepFunctionsHandler", new Dictionary<string, string>(), props.DdApiKeySecret)).Function;
        
        var logGroup = new LogGroup(this, "DotnetTestWorkflowLogGroup", new LogGroupProps()
        {
            LogGroupName = "/aws/vendedlogs/states/DotnetTestWorkflowLogGroup",
            Retention = RetentionDays.ONE_DAY,
            RemovalPolicy = RemovalPolicy.DESTROY
        });
        
        this.Workflow = new StateMachine(this, "DotnetTestWorkflow", new StateMachineProps()
        {
            DefinitionBody = DefinitionBody.FromFile("./src/DotnetLambdaHybridTracing/workflow/workflow.asl.json"),
            DefinitionSubstitutions = new Dictionary<string, string>(1)
            {
                {"StepFunctionsInvokeFunctionArn", StepFunctionsHandlerFunction.FunctionArn}
            },
            Logs = new LogOptions
            {
                Destination = logGroup,
                IncludeExecutionData = true,
                Level = LogLevel.ALL
            }
        });
        
        StepFunctionsHandlerFunction.GrantInvoke(this.Workflow);
        
        Tags.Of(Workflow).Add("DD_ENHANCED_METRICS", "true");
        Tags.Of(Workflow).Add("DD_TRACE_ENABLED", "true");
    }

    private void AddEventBridgeToSqsConsumer(BackgroundWorkerProps props)
    {
        var eventBridgeDeadLetterQueue = new Queue(this, "EventBridgeConsumer-DLQ");
        EventBridgeConsumerQueue = new Queue(this, "EventBridgeConsumerQueue", new QueueProps
        {
            DeadLetterQueue = new DeadLetterQueue
            {
                Queue = eventBridgeDeadLetterQueue,
                MaxReceiveCount = 3
            }
        });
        
        EventBridgeToSqsConsumerFunction = new InstrumentedFunction(this, "EventBridgeToSqsConsumer",
            new FunctionProps(props.ServiceName, props.Env, props.Version, "EventBridgeToSqsConsumer", "./functions/background-worker/",
                "BackgroundWorkers::BackgroundWorkers.Functions_EventBridgeToSqsConsumer_Generated::EventBridgeToSqsConsumer", new Dictionary<string, string>(1)
                {
                    {"STEP_FUNCTION_ARN", this.Workflow.StateMachineArn}
                }, props.DdApiKeySecret)).Function;
        EventBridgeToSqsConsumerFunction.AddEventSource(new SqsEventSource(EventBridgeConsumerQueue));
    }

    private void AddSnsToSqsConsumer(BackgroundWorkerProps props)
    {
        var snsDeadLetterQueue = new Queue(this, "SNSConsumer-DLQ");
        SnsConsumerQueue = new Queue(this, "SNSConsumerQueue", new QueueProps
        {
            DeadLetterQueue = new DeadLetterQueue
            {
                Queue = snsDeadLetterQueue,
                MaxReceiveCount = 3
            }
        });
        
        SnsToSqsConsumerFunction = new InstrumentedFunction(this, "SNSToSQSConsumer",
            new FunctionProps(props.ServiceName, props.Env, props.Version, "SNSToSQSConsumer", "./functions/background-worker/",
                "BackgroundWorkers::BackgroundWorkers.Functions_SnsToSqsConsumer_Generated::SnsToSqsConsumer", new Dictionary<string, string>()
                {
                    {"EVENT_BUS_NAME", props.SharedEventBus.EventBusName}
                }, props.DdApiKeySecret)).Function;
        
        SnsToSqsConsumerFunction.AddEventSource(new SqsEventSource(SnsConsumerQueue));
        props.SharedEventBus.GrantPutEventsTo(SnsToSqsConsumerFunction);
    }

    private void AddSnsConsumer(BackgroundWorkerProps props)
    {
        SnsConsumerFunction = new InstrumentedFunction(this, "SNSConsumer",
            new FunctionProps(props.ServiceName, props.Env, props.Version, "SNSConsumer", "./functions/background-worker/",
                "BackgroundWorkers::BackgroundWorkers.Functions_SnsConsumer_Generated::SnsConsumer", new Dictionary<string, string>(), props.DdApiKeySecret)).Function;
    }
    
    private void AddEventBridgeConsumer(BackgroundWorkerProps props)
    {
        EventBridgeConsumerFunction = new InstrumentedFunction(this, "EventBridgeConsumer",
            new FunctionProps(props.ServiceName, props.Env, props.Version, "EventBridgeConsumer", "./functions/background-worker/",
                "BackgroundWorkers::BackgroundWorkers.Functions_EventBridgeConsumer_Generated::EventBridgeConsumer", new Dictionary<string, string>(), props.DdApiKeySecret)).Function;
    }
}