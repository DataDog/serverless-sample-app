using System.Text.Json;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.SNSEvents;
using Datadog.Trace;
using Inventory.Ordering.Core.NewProductAdded;

namespace Inventory.Ordering.Adapters;

public class Functions(NewProductAddedEventHandler handler)
{
    [LambdaFunction]
    public async Task HandleProductAdded(SNSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();

        foreach (var record in evt.Records)
        {
            var processingSpan = Tracer.Instance.StartActive("process", new SpanCreationSettings()
            {
                Parent = activeSpan?.Context
            });
            record.AddToTelemetry();
            
            try
            {
                using var timer = record.StartProcessingTimer();

                var evtData = JsonSerializer.Deserialize<NewProductAddedEvent>(record.Sns.Message);

                if (evtData is null)
                    throw new ArgumentException("Event payload does not serialize to a `NewProductAddedEvent`");

                await handler.Handle(evtData);

                processingSpan.Close();
                record.AddProcessingMetrics();
            }
            catch (Exception e)
            {
                processingSpan.Span?.SetTag("error.type", e.GetType().Name);
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