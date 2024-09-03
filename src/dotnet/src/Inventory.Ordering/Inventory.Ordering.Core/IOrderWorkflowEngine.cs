namespace Inventory.Ordering.Core;

public interface IOrderWorkflowEngine
{
    Task StartWorkflowFor(string productId);
}