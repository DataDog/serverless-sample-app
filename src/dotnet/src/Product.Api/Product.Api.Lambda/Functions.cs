using Amazon.Lambda.Annotations;
using Amazon.Lambda.Annotations.APIGateway;
using Amazon.Lambda.Core;
using AWS.Lambda.Powertools.Logging;
using Datadog.Trace;
using Product.Api.Core;
using Product.Api.Core.CreateProduct;
using Product.Api.Core.DeleteProduct;
using Product.Api.Core.GetProduct;
using Product.Api.Core.UpdateProduct;

[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace Product.Api;

public class Functions
{
    private readonly CreateProductCommandHandler _createProductHandler;
    private readonly DeleteProductCommandHandler _deleteProductHandler;
    private readonly UpdateProductCommandHandler _updateProductHandler;
    private readonly GetProductQueryHandler _getProductQueryHandler;
    
    public Functions(CreateProductCommandHandler createProductHandler, DeleteProductCommandHandler deleteProductHandler, UpdateProductCommandHandler updateProductHandler, GetProductQueryHandler getProductQueryHandler)
    {
        _createProductHandler = createProductHandler;
        _deleteProductHandler = deleteProductHandler;
        _updateProductHandler = updateProductHandler;
        _getProductQueryHandler = getProductQueryHandler;
    }

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

            var result = await this._getProductQueryHandler.Handle(new GetProductQuery(productId));

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

            var result = await this._createProductHandler.Handle(command);

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

            var result = await this._deleteProductHandler.Handle(new DeleteProductCommand(productId));

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

            var result = await this._updateProductHandler.Handle(command);

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