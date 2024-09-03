using System.Text.Json;
using Amazon.Lambda.Annotations;
using Amazon.Lambda.SNSEvents;
using Datadog.Trace;
using ProductEventPublisher.Core;
using ProductEventPublisher.Core.InternalEvents;

namespace ProductEventPublisher.Adapters;

public class HandlerFunctions(EventAdapter eventAdapter)
{
    [LambdaFunction]
    public async Task HandleUpdated(SNSEvent evt)
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

                var evtData = JsonSerializer.Deserialize<ProductUpdatedEvent>(record.Sns.Message);

                if (evtData is null)
                {
                    throw new ArgumentException("Event payload does not serialize to a `ProductUpdatedEvent`");
                }

                await eventAdapter.HandleInternalEvent(evtData);

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
    
    [LambdaFunction]
    public async Task HandleCreated(SNSEvent evt)
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

                var evtData = JsonSerializer.Deserialize<ProductCreatedEvent>(record.Sns.Message);

                if (evtData is null)
                {
                    throw new ArgumentException("Event payload does not serialize to a `ProductUpdatedEvent`");
                }

                await eventAdapter.HandleInternalEvent(evtData);

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
    
    [LambdaFunction]
    public async Task HandleDeleted(SNSEvent evt)
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

                var evtData = JsonSerializer.Deserialize<ProductDeletedEvent>(record.Sns.Message);

                if (evtData is null)
                {
                    throw new ArgumentException("Event payload does not serialize to a `ProductUpdatedEvent`");
                }

                await eventAdapter.HandleInternalEvent(evtData);

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