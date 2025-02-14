// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Datadog.Trace;
using FluentValidation;

namespace ProductApi.Core.CreateProduct;

public class CreateProductCommandHandler(IProducts products, IEventPublisher eventPublisher)
{
    public async Task<HandlerResponse<ProductDto>> Handle(CreateProductCommand command)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        try
        {
            activeSpan?.SetTag("product.name", command.Name);
            activeSpan?.SetTag("product.price", command.Price.ToString("n2"));

            var product = new Product(new ProductName(command.Name), new ProductPrice(command.Price));

            await products.AddNew(product);

            activeSpan?.SetTag("product.id", product.ProductId);

            await eventPublisher.Publish(new ProductCreatedEvent(product));

            return new HandlerResponse<ProductDto>(new ProductDto(product), true, new List<string>(0));
        }
        catch (ValidationException e)
        {
            activeSpan?.SetException(e);

            return new HandlerResponse<ProductDto>(null, false, e.Errors.Select(error => error.ErrorMessage).ToList());
        }
    }
}