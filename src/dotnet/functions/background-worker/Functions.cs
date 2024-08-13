using System.Text.Json;
using System.Text.Json.Serialization;
using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using Amazon.Lambda.Core;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.CloudWatchEvents;
using Amazon.Lambda.SNSEvents;
using Amazon.Lambda.SQSEvents;
using Amazon.StepFunctions;
using Amazon.StepFunctions.Model;
using AWS.Lambda.Powertools.Logging;
using BackgroundWorkers.IntegrationEvents;
using BackgroundWorkers.PrivateEvents;
using Microsoft.Extensions.Configuration;

[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace BackgroundWorkers;

public class Functions
{
    private readonly string _eventSource = $"{Environment.GetEnvironmentVariable("ENV")}.orders";
    private readonly AmazonEventBridgeClient _eventBridgeClient;
    private readonly AmazonStepFunctionsClient _stepFunctionsClient;
    private readonly IConfiguration _configuration;

    public Functions(AmazonEventBridgeClient eventBridgeClient, IConfiguration configuration, AmazonStepFunctionsClient stepFunctionsClient)
    {
        _eventBridgeClient = eventBridgeClient;
        _configuration = configuration;
        _stepFunctionsClient = stepFunctionsClient;
    }
    
    [LambdaFunction]
    public void SnsConsumer(SNSEvent sqsEvent)
    {
        try
        {
            foreach (var message in sqsEvent.Records)
            {
                Logger.LogInformation("Deserializing message to 'OrderCreatedEvent'");
                var privateEvent = JsonSerializer.Deserialize<OrderCreatedEvent>(message.Sns.Message);

                if (privateEvent == null)
                {
                    Logger.LogError("Failure deserializing message body to 'OrderCreatedEvent'");
                    Logger.LogError($"OriginalMessageBody: {message.Sns.Message}");
                    continue;
                }
                
                Logger.LogInformation($"Success, orderId is {privateEvent.OrderId}");
            }
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failure handling SQS messages");
        }
    }

    [LambdaFunction]
    public async Task<SQSBatchResponse> SnsToSqsConsumer(SQSEvent sqsEvent)
    {
        var batchItemFailures = new List<SQSBatchResponse.BatchItemFailure>();
        
        try
        {
            foreach (var message in sqsEvent.Records)
            {
                Logger.LogInformation("Deserializing message to 'OrderCreatedEvent'");
                var snsMessageWrapper = JsonSerializer.Deserialize<SnsMessageWrapper>(message.Body);
                var privateEvent = JsonSerializer.Deserialize<OrderCreatedEvent>(snsMessageWrapper!.Message);

                if (privateEvent is null)
                {
                    batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure()
                    {
                        ItemIdentifier = message.MessageId
                    });
                    Logger.LogError("Failure deserializing message body to 'OrderCreatedEvent'");
                    Logger.LogError($"OriginalMessageBody: {message.Body}");
                    continue;
                }
                
                Logger.LogInformation($"Success, orderId is {privateEvent.OrderId}");

                PutEventsRequestEntry evt = new()
                {
                    EventBusName = this._configuration["EVENT_BUS_NAME"],
                    Source = _eventSource,
                    DetailType = "order.orderCreated",
                    Detail = JsonSerializer.Serialize(new OrderCreatedIntegrationEvent()
                    {
                        OrderId = privateEvent.OrderId
                    })
                };
                
                Logger.LogInformation($"Publishing {evt.DetailType} to bus {evt.EventBusName} with source {evt.Source}");

                await this._eventBridgeClient.PutEventsAsync(new PutEventsRequest()
                {
                    Entries = [evt]
                });
            }
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failure handling SQS messages");
        }

        return new SQSBatchResponse(batchItemFailures);
    }

    [LambdaFunction]
    public async Task<SQSBatchResponse> EventBridgeToSqsConsumer(SQSEvent sqsEvent)
    {
        var batchItemFailures = new List<SQSBatchResponse.BatchItemFailure>();
        
        try
        {
            foreach (var message in sqsEvent.Records)
            {
                var eventBridgeWrapper = JsonSerializer.Deserialize<EventBridgeWrapper<OrderCreatedIntegrationEvent>>(message.Body);

                if (eventBridgeWrapper is null)
                {
                    Logger.LogError("Failure deserializing event bridge wrapper");
                    batchItemFailures.Add(new SQSBatchResponse.BatchItemFailure()
                    {
                        ItemIdentifier = message.MessageId
                    });
                    continue;
                }
                
                await this._stepFunctionsClient.StartExecutionAsync(new StartExecutionRequest()
                {
                    StateMachineArn = this._configuration["STEP_FUNCTION_ARN"],
                    Input = JsonSerializer.Serialize(eventBridgeWrapper.Detail)
                });
            }
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failure handling SQS messages");
        }

        //return new SQSBatchResponse(batchItemFailures);
        return new SQSBatchResponse(batchItemFailures);
    }
    
    [LambdaFunction]
    public Task<SQSBatchResponse> EventBridgeConsumer(CloudWatchEvent<OrderCreatedEvent> eventBridgeEvent)
    {
        var batchItemFailures = new List<SQSBatchResponse.BatchItemFailure>();
        
        try
        {
            Logger.LogInformation($"OrderId from event is {eventBridgeEvent.Detail.OrderId}");
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failure handling SQS messages");
        }

        //return new SQSBatchResponse(batchItemFailures);
        return Task.FromResult(new SQSBatchResponse(batchItemFailures));
    }

    [LambdaFunction]
    public async Task<OrderCreatedIntegrationEvent> StepFunctionsHandler(OrderCreatedIntegrationEvent evt)
    {
        Logger.LogInformation(evt.OrderId);

        await Task.Delay(TimeSpan.FromSeconds(3));

        return evt;
    }
}

public record SnsMessageWrapper
{
    public string Message { get; set; } = "";
}

public record EventBridgeWrapper<T>
{
    [JsonPropertyName("detail")]
    public T? Detail { get; set; }
}