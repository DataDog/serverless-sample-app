using System.Text.Json;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.SQSEvents;
using Datadog.Trace;

namespace Analytics.Adapters;

public class HandlerFunctions
{
    [LambdaFunction]
    public void HandleEvents(SQSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();
        
        foreach (var record in evt.Records)
        {
            var processingSpan = Tracer.Instance.StartActive("process", new SpanCreationSettings
            {
                Parent = activeSpan?.Context,
            });

            try
            {
                record.AddToTelemetry();
                using var timer = record.StartProcessingTimer();

                var messageWrapper = JsonSerializer.Deserialize<EventBridgeMessageWrapper>(record.Body);

                if (messageWrapper is null)
                {
                    throw new ArgumentException("Cannot deserialize event to 'EventBridgeMessageWrapper");
                }
                
                messageWrapper.AddToTelemetry();
                processingSpan.Close();
                record.AddProcessingMetrics();
            }
            catch (Exception e)
            {
                record.AddProcessingMetrics(e);
                throw;
            }
            finally
            {
                processingSpan.Close();
            }
        }
    }
}