using Amazon.Lambda.Annotations;
using Amazon.Lambda.Annotations.APIGateway;
using AWS.Lambda.Powertools.Logging;
using Datadog.Trace;
using Product.Api.Core.CreateProduct;
using Product.Api.Core.DeleteProduct;
using Product.Api.Core.GetProduct;
using Product.Api.Core.UpdateProduct;

namespace Product.Api;

public class Functions(
    CreateProductCommandHandler createProductHandler,
    DeleteProductCommandHandler deleteProductHandler,
    UpdateProductCommandHandler updateProductHandler,
    GetProductQueryHandler getProductQueryHandler)
{
    [LambdaFunction]
    [HttpApi(LambdaHttpMethod.Get, "/product/{productId}")]
    [Logging(LogEvent = true)]
    public async Task<IHttpResult> GetProduct(string productId)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        try
        {
            Logger.LogInformation($"Attempting to retrieve {productId}");
            activeSpan?.SetTag("order.orderIdentifier", productId);

            var result = await getProductQueryHandler.Handle(new GetProductQuery(productId));

            return result.IsSuccess ? HttpResults.Ok(result) : HttpResults.BadRequest(result);
        }
        catch (Exception ex)
        {
            activeSpan?.SetException(ex);
            Logger.LogError(ex, "Failure retrieving product");
            return HttpResults.NotFound();
        }
    }
    
    
    [LambdaFunction]
    [HttpApi(LambdaHttpMethod.Post, "/product")]
    [Logging(LogEvent = true)]
    public async Task<IHttpResult> CreateProduct([FromBody] CreateProductCommand command)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        try
        {
            Logger.LogInformation($"Attempting to create order with name {command.Name}");
            activeSpan?.SetTag("product.productName", command.Name);

            var result = await createProductHandler.Handle(command);

            return result.IsSuccess ? HttpResults.Ok(result) : HttpResults.BadRequest(result);
        }
        catch (Exception ex)
        {
            activeSpan?.SetException(ex);
            Logger.LogError(ex, "Failure creating product");
            return HttpResults.InternalServerError();
        }
    }

    [LambdaFunction]
    [HttpApi(LambdaHttpMethod.Delete, "/product/{productId}")]
    [Logging(LogEvent = true)]
    public async Task<IHttpResult> DeleteProduct(string productId)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        try
        {
            Logger.LogInformation($"Attempting to delete product with id {productId}");
            activeSpan?.SetTag("product.productId", productId);

            var result = await deleteProductHandler.Handle(new DeleteProductCommand(productId));

            return result.IsSuccess ? HttpResults.Ok(result) : HttpResults.BadRequest(result);
        }
        catch (Exception ex)
        {
            activeSpan?.SetException(ex);
            Logger.LogError(ex, "Failure deleting product");
            return HttpResults.InternalServerError();
        }
    }

    [LambdaFunction]
    [HttpApi(LambdaHttpMethod.Put, "/product")]
    [Logging(LogEvent = true)]
    public async Task<IHttpResult> UpdateProduct([FromBody] UpdateProductCommand command)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        try
        {
            Logger.LogInformation($"Attempting to update product with id {command.Id}");
            activeSpan?.SetTag("product.productId", command.Id);

            var result = await updateProductHandler.Handle(command);

            return result.IsSuccess ? HttpResults.Ok(result) : HttpResults.BadRequest(result);
        }
        catch (Exception ex)
        {
            activeSpan?.SetException(ex);
            Logger.LogError(ex, "Failure updating product");
            return HttpResults.InternalServerError();
        }
    }
}