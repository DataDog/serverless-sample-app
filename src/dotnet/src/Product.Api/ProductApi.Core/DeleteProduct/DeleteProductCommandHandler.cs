namespace ProductApi.Core.DeleteProduct;

public class DeleteProductCommandHandler(IProducts products, IEventPublisher eventPublisher)
{
    public async Task<HandlerResponse<bool>> Handle(DeleteProductCommand command)
    {
        await products.RemoveWithId(command.ProductId);

        await eventPublisher.Publish(new ProductDeletedEvent(command.ProductId));

        return new HandlerResponse<bool>(true, true, new List<string>(0));
    }
}