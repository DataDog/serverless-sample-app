using System.Text.Json;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.SNSEvents;
using Datadog.Trace;
using ProductApi.Core.PricingChanged;

namespace ProductApi.Adapters;

public class HandlerFunctions(PricingUpdatedEventHandler pricingUpdatedHandler)
{
    [LambdaFunction]
    public async Task HandlePricingUpdated(SNSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        evt.AddToTelemetry();
        
        foreach (var record in evt.Records)
        {
            var processingSpan = Tracer.Instance.StartActive("process", new SpanCreationSettings()
            {
                Parent = activeSpan?.Context
            });

            try
            {
                record.AddToTelemetry();
                using var timer = record.StartProcessingTimer();

                var evtData = JsonSerializer.Deserialize<PricingUpdatedEvent>(record.Sns.Message);

                if (evtData is null)
                {
                    throw new ArgumentException("Event payload does not serialize to a `ProductUpdatedEvent`");
                }

                await pricingUpdatedHandler.Handle(evtData);

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