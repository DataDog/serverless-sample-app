namespace Product.Api.Core.UpdateProduct;

public class UpdateProductCommandHandler(IProductRepository productRepository, IEventPublisher eventPublisher, UpdateProductValidator updateProductValidator)
{
    public async Task<HandlerResponse<ProductDto>> Handle(UpdateProductCommand command)
    {
        var validationResult = await updateProductValidator.ValidateAsync(command);

        if (!validationResult.IsValid)
        {
            return new HandlerResponse<ProductDto>(null, false, validationResult.Errors.Select(error => error.ErrorMessage).ToList());
        }

        var product = await productRepository.GetProduct(command.Id);

        if (product is null)
        {
            return new HandlerResponse<ProductDto>(null, false, new List<string>(1) { "Product not found" });
        }
        
        product.UpdateProduct(command.Name, command.Price);

        if (product.IsUpdated)
        {
            await productRepository.UpdateProduct(product);

            await eventPublisher.Publish(new ProductUpdatedEvent(product));   
            
            return new HandlerResponse<ProductDto>(new ProductDto(product), true, new List<string>(0));
        }
        
        return new HandlerResponse<ProductDto>(new ProductDto(product), true, new List<string>(1){"No changes required"});
    }
}