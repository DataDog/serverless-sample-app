// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

using System.Collections.Generic;
using Amazon.CDK.AWS.DynamoDB;
using Amazon.CDK.AWS.Lambda.EventSources;
using Amazon.CDK.AWS.SecretsManager;
using Amazon.CDK.AWS.SNS;
using Constructs;
using ServerlessGettingStarted.CDK.Constructs;

namespace ServerlessGettingStarted.CDK.Services.Product.Api.Workers;

public record ProductApiWorkersProps(SharedProps Shared, ISecret DdApiKeySecret, ITable ProductTable, ITopic PricingUpdatedTopic, ITopic ProductStockUpdatedTopic);

public class ProductApiWorkers : Construct
{
    public ProductApiWorkers(Construct scope, string id, ProductApiWorkersProps props) : base(scope, id)
    {
        var apiEnvironmentVariables = new Dictionary<string, string>(2)
        {
            { "TABLE_NAME", props.ProductTable.TableName },
        };
        
        var handlePricingUpdated = new InstrumentedFunction(this, "HandlePricingUpdatedFunction",
            new FunctionProps(props.Shared,"HandlePricingUpdated", "../src/Product.Api/ProductApi.Adapters/",
                "ProductApi.Adapters::ProductApi.Adapters.HandlerFunctions_HandlePricingUpdated_Generated::HandlePricingUpdated", apiEnvironmentVariables, props.DdApiKeySecret));
        handlePricingUpdated.Function.AddEventSource(new SnsEventSource(props.PricingUpdatedTopic));

        props.ProductTable.GrantReadData(handlePricingUpdated.Function);
        props.ProductTable.GrantWriteData(handlePricingUpdated.Function);
        
        var handleStockUpdated = new InstrumentedFunction(this, "HandleProductStockUpdatedFunction",
            new FunctionProps(props.Shared,"HandleProductStockUpdatedFunction", "../src/Product.Api/ProductApi.Adapters/",
                "ProductApi.Adapters::ProductApi.Adapters.HandlerFunctions_HandleStockUpdated_Generated::HandleStockUpdated", apiEnvironmentVariables, props.DdApiKeySecret));
        handleStockUpdated.Function.AddEventSource(new SnsEventSource(props.ProductStockUpdatedTopic));

        props.ProductTable.GrantReadData(handleStockUpdated.Function);
        props.ProductTable.GrantWriteData(handleStockUpdated.Function);
    }
}