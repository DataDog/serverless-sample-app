using Product.Api.Core.CreateProduct;

namespace Product.Api.Core.DeleteProduct;

public class DeleteProductCommandHandler(IProductRepository productRepository, IEventPublisher eventPublisher, DeleteProductValidator validator)
{
    public async Task<HandlerResponse<bool>> Handle(DeleteProductCommand command)
    {
        var validationResult = await validator.ValidateAsync(command);

        if (!validationResult.IsValid)
        {
            return new HandlerResponse<bool>(false, false, validationResult.Errors.Select(error => error.ErrorMessage).ToList());
        }

        await productRepository.DeleteProduct(command.ProductId);

        await eventPublisher.Publish(new ProductDeletedEvent(command.ProductId));

        return new HandlerResponse<bool>(true, true, new List<string>(0));
    }
}