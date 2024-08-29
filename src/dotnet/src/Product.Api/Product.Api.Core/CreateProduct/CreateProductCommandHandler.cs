namespace Product.Api.Core.CreateProduct;

public class CreateProductCommandHandler(IProductRepository productRepository, IEventPublisher eventPublisher, CreateProductValidator createProductValidator)
{
    public async Task<HandlerResponse<ProductDto>> Handle(CreateProductCommand command)
    {
        var validationResult = await createProductValidator.ValidateAsync(command);

        if (!validationResult.IsValid)
        {
            return new HandlerResponse<ProductDto>(null, false, validationResult.Errors.Select(error => error.ErrorMessage).ToList());
        }

        var product = new Product(command.Name, command.Price);

        await productRepository.CreateProduct(product);

        await eventPublisher.Publish(new ProductCreatedEvent(product));

        return new HandlerResponse<ProductDto>(new ProductDto(product), true, new List<string>(0));
    }
}