using Amazon.Lambda.Annotations;
using Amazon.Lambda.Annotations.APIGateway;
using Amazon.Lambda.Core;
using Api.Core;
using AWS.Lambda.Powertools.Logging;
using Datadog.Trace;

[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace Api;

public class Functions
{
    private readonly IOrderRepository _orderRepository;
    
    public Functions(IOrderRepository orderRepository)
    {
        _orderRepository = orderRepository;
    }

    [LambdaFunction]
    [HttpApi(LambdaHttpMethod.Get, "/order/{orderId}")]
    public async Task<IHttpResult> GetOrder(string orderId)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        try
        {
            // Disable to check if log linking works
            // Logger.AppendKey("dd.trace_id", Tracer.Instance.ActiveScope.Span.TraceId.ToString());
            // Logger.AppendKey("dd.span_id", Tracer.Instance.ActiveScope.Span.SpanId.ToString());
            
            Logger.LogInformation($"Attempting to retrieve {orderId}");
            activeSpan?.SetTag("order.orderIdentifier", orderId);
            
            var order = await this._orderRepository.GetOrder(orderId);

            return HttpResults.Ok(order);
        }
        catch (Exception ex)
        {
            activeSpan?.SetException(ex);
            Logger.LogError(ex, "Failure retrieving orderId");
            return HttpResults.NotFound();
        }
    }
    
    
    [LambdaFunction]
    [HttpApi(LambdaHttpMethod.Post, "/order")]
    [Logging(LogEvent = true)]
    public async Task<IHttpResult> CreateOrder([FromBody] Order order)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        try
        {
            Logger.LogInformation($"Attempting to create order with ID {order.OrderId}");
            activeSpan?.SetTag("order.orderIdentifier", order.OrderId);
            
            await this._orderRepository.CreateOrder(order);

            return HttpResults.Ok(order);
        }
        catch (Exception ex)
        {
            activeSpan?.SetException(ex);
            Logger.LogError(ex, "Failure creating order");
            return HttpResults.InternalServerError();
        }
    }
}