using Datadog.Trace;
using FluentValidation;

namespace ProductService.Api.Core.CreateProduct;

public class CreateProductCommandHandler(IProducts products, IEventPublisher eventPublisher)
{
    public async Task<HandlerResponse<ProductDto>> Handle(CreateProductCommand command)
    {
        var activeSpan = Tracer.Instance.ActiveScope?.Span;
        
        try
        {
            var product = new Product(new ProductName(command.Name), new ProductPrice(command.Price));

            await products.AddNew(product);

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