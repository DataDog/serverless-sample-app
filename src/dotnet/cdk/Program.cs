// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using Amazon.CDK;
using ServerlessGettingStarted.CDK.Services.Analytics;
using ServerlessGettingStarted.CDK.Services.Inventory.Acl;
using ServerlessGettingStarted.CDK.Services.Inventory.Api;
using ServerlessGettingStarted.CDK.Services.Inventory.Ordering;
using ServerlessGettingStarted.CDK.Services.Product.Acl;
using ServerlessGettingStarted.CDK.Services.Product.Api;
using ServerlessGettingStarted.CDK.Services.Product.Api.Workers;
using ServerlessGettingStarted.CDK.Services.Product.EventPublisher;
using ServerlessGettingStarted.CDK.Services.Product.Pricing;
using ServerlessGettingStarted.CDK.Services.Shared;

namespace ServerlessGettingStarted.CDK;

internal sealed class Program
{
    public static void Main(string[] args)
    {
        var app = new App();
        var sharedStack = new SharedStack(app, "DotnetSharedStack");

        var productAcl = new ProductAclServiceStack(app, "DotnetProductAcl", new StackProps());
        productAcl.AddDependency(sharedStack);

        var productApiStack = new ProductApiStack(app, "DotnetProductApiStack", new StackProps());

        var pricingStack = new ProductPricingStack(app, "DotnetProductPricingStack", new StackProps());
        pricingStack.AddDependency(productApiStack);

        var productApiWorker = new ProductApiWorkersStack(app, "DotnetProductApiWorkers", new StackProps());
        productApiWorker.AddDependency(pricingStack);
        productApiStack.AddDependency(productAcl);

        var productEventPublisher =
            new ProductEventPublisherStack(app, "DotnetProductEventPublisher", new StackProps());
        productEventPublisher.AddDependency(sharedStack);
        productEventPublisher.AddDependency(productApiStack);

        var inventoryAcl = new InventoryAclServiceStack(app, "DotnetInventoryAcl", new StackProps());
        inventoryAcl.AddDependency(sharedStack);

        var inventoryApi = new InventoryApiStack(app, "DotnetInventoryApiStack", new StackProps());
        inventoryApi.AddDependency(sharedStack);

        var inventoryOrdering = new InventoryOrderingServiceStack(app, "DotnetInventoryOrdering", new StackProps());
        inventoryOrdering.AddDependency(inventoryAcl);
        inventoryOrdering.AddDependency(inventoryApi);

        var analytics = new AnalyticsServiceStack(app, "DotnetAnalyticsService", new StackProps());
        analytics.AddDependency(sharedStack);

        app.Synth();
    }
}