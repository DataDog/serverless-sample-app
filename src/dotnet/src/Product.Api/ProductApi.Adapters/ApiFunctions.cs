// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.Lambda.Annotations;
using Amazon.Lambda.Annotations.APIGateway;
using AWS.Lambda.Powertools.Logging;
using Datadog.Trace;
using ProductApi.Core.CreateProduct;
using ProductApi.Core.DeleteProduct;
using ProductApi.Core.GetProduct;
using ProductApi.Core.ListProducts;
using ProductApi.Core.UpdateProduct;

namespace ProductApi.Adapters;

public class ApiFunctions(
    CreateProductCommandHandler createProductHandler,
    DeleteProductCommandHandler deleteProductHandler,
    UpdateProductCommandHandler updateProductHandler,
    GetProductQueryHandler getProductQueryHandler,
    ListProductsQueryHandler listProductsQueryHandler)
{
    [LambdaFunction]
    [RestApi(LambdaHttpMethod.Get, "/product")]
    public async Task<IHttpResult> ListProducts()
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        try
        {
            var result = await listProductsQueryHandler.Handle(new ListProductsQuery());

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
    [RestApi(LambdaHttpMethod.Get, "/product/{productId}")]
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
    [RestApi(LambdaHttpMethod.Post, "/product")]
    public async Task<IHttpResult> CreateProduct([FromBody] CreateProductCommand command)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        try
        {
            Logger.LogInformation($"Attempting to create product with name {command.Name}");
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
    [RestApi(LambdaHttpMethod.Delete, "/product/{productId}")]
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
    [RestApi(LambdaHttpMethod.Put, "/product")]
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