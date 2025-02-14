// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Datadog.Trace;
using FluentValidation;

namespace ProductApi.Core.UpdateProduct;

public class UpdateProductCommandHandler(IProducts products, IEventPublisher eventPublisher)
{
    public async Task<HandlerResponse<ProductDto>> Handle(UpdateProductCommand command)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;

        try
        {
            var product = await products.WithId(command.Id);

            if (product is null)
                return new HandlerResponse<ProductDto>(null, false, new List<string>(1) { "Product not found" });

            product.UpdateProductDetailsFrom(new ProductDetails(new ProductName(command.Name),
                new ProductPrice(command.Price)));

            if (!product.IsUpdated)
                return new HandlerResponse<ProductDto>(new ProductDto(product), true,
                    new List<string>(1) { "No changes required" });

            product.ClearPricing();
            await products.UpdateExistingFrom(product);

            await eventPublisher.Publish(new ProductUpdatedEvent(product));

            return new HandlerResponse<ProductDto>(new ProductDto(product), true, new List<string>(0));
        }
        catch (ValidationException e)
        {
            activeSpan?.SetException(e);

            return new HandlerResponse<ProductDto>(null, false, e.Errors.Select(error => error.ErrorMessage).ToList());
        }
    }
}