namespace Inventory.Ordering.Core.NewProductAdded;

public class NewProductAddedEventHandler(IOrderWorkflowEngine workflowEngine)
{
    public async Task Handle(NewProductAddedEvent evt)
    {
        if (string.IsNullOrEmpty(evt.ProductId))
        {
            throw new Exception("ProductID is null or empty, returning");
        }
        
        await workflowEngine.StartWorkflowFor(evt.ProductId);
    }
}