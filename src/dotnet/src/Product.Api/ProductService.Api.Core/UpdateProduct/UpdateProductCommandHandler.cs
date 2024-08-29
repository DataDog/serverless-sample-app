using Datadog.Trace;
using FluentValidation;

namespace ProductService.Api.Core.UpdateProduct;

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