using Amazon.Lambda.Annotations;
using Amazon.Lambda.Annotations.APIGateway;
using AWS.Lambda.Powertools.Logging;
using Datadog.Trace;
using ProductService.Api.Core.CreateProduct;
using ProductService.Api.Core.DeleteProduct;
using ProductService.Api.Core.GetProduct;
using ProductService.Api.Core.UpdateProduct;

namespace ProductService.Api;

public class Functions(
    CreateProductCommandHandler createProductHandler,
    DeleteProductCommandHandler deleteProductHandler,
    UpdateProductCommandHandler updateProductHandler,
    GetProductQueryHandler getProductQueryHandler)
{
    [LambdaFunction]
    [HttpApi(LambdaHttpMethod.Get, "/product/{productId}")]
    public async Task<IHttpResult> GetProduct(string productId)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        try
        {
            Logger.LogInformation($"Attempting to retrieve {productId}");
            activeSpan?.SetTag("product.productId", productId);

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