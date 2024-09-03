using Amazon.CDK;
using ServerlessGettingStarted.CDK.Services.Analytics;
using ServerlessGettingStarted.CDK.Services.Inventory.Acl;
using ServerlessGettingStarted.CDK.Services.Inventory.Ordering;
using ServerlessGettingStarted.CDK.Services.Product.Api;
using ServerlessGettingStarted.CDK.Services.Product.Api.Workers;
using ServerlessGettingStarted.CDK.Services.Product.EventPublisher;
using ServerlessGettingStarted.CDK.Services.Product.Pricing;
using ServerlessGettingStarted.CDK.Services.Shared;

namespace ServerlessGettingStarted.CDK
{
    sealed class Program
    {
        public static void Main(string[] args)
        {
            var app = new App();
            var sharedStack = new SharedStack(app, "DotnetSharedStack");
            
            var productApiStack = new ProductApiStack(app, "DotnetProductApiStack", new StackProps());
            
            var pricingStack = new ProductPricingStack(app, "DotnetProductPricingStack", new StackProps());
            pricingStack.AddDependency(productApiStack);
            
            var productApiWorker = new ProductApiWorkersStack(app, "DotnetProductApiWorkers", new StackProps());
            productApiWorker.AddDependency(pricingStack);

            var productEventPublisher = new ProductEventPublisherStack(app, "DotnetProductEventPublisher", new StackProps());
            productEventPublisher.AddDependency(sharedStack);
            productEventPublisher.AddDependency(productApiStack);

            var inventoryAcl = new InventoryAclServiceStack(app, "DotnetInventoryAcl", new StackProps());
            inventoryAcl.AddDependency(sharedStack);

            var inventoryOrdering = new InventoryOrderingServiceStack(app, "DotnetInventoryOrdering", new StackProps());
            inventoryOrdering.AddDependency(inventoryAcl);

            var analytics = new AnalyticsServiceStack(app, "DotnetAnalyticsService", new StackProps());
            analytics.AddDependency(sharedStack);
            
            app.Synth();
        }
    }
}
