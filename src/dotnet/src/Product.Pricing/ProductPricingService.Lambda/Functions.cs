using System.Text.Json;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.SNSEvents;
using Datadog.Trace;
using ProductPricingService.Core;

namespace ProductPricingService.Lambda;

public class Functions(PricingService pricingService)
{
    [LambdaFunction]
    public async Task HandleProductCreated(SNSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        foreach (var record in evt.Records)
        {
            var processingSpan = Tracer.Instance.StartActive("process", new SpanCreationSettings()
            {
                Parent = activeSpan?.Context
            });
            
            var evtData = JsonSerializer.Deserialize<ProductCreatedEvent>(record.Sns.Message);

            if (evtData is null)
            {
                throw new ArgumentException("Event payload does not serialize to a `ProductCreatedEvent`");
            }

            await pricingService.GeneratePricingFor(new ProductPrice(evtData.Price));
            
            processingSpan.Close();
        }
    }
    
    [LambdaFunction]
    public async Task HandleProductUpdated(SNSEvent evt)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        foreach (var record in evt.Records)
        {
            var processingSpan = Tracer.Instance.StartActive("process", new SpanCreationSettings()
            {
                Parent = activeSpan?.Context
            });
            
            var evtData = JsonSerializer.Deserialize<ProductUpdatedEvent>(record.Sns.Message);

            if (evtData is null)
            {
                throw new ArgumentException("Event payload does not serialize to a `ProductUpdatedEvent`");
            }

            await pricingService.GeneratePricingFor(new ProductPrice(evtData.Price));
            
            processingSpan.Close();
        }
    }
}