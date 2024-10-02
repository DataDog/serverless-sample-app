# Serverless Getting Started

This repository contains source code for demonstrating the getting started experience when using native tracing through various AWS serverless technologies. It implements the same architecture in all the available Lambda runtimes, and different IaC tools to provide a getting started experience for where ever you are today.

![Architecture Diagram](img/serverless-lambda-tracing.png)

## Implementations

|                      | Node                                             | Python | .NET                                | Java                                           | Go  | Rust |
| -------------------- | ------------------------------------------------ | ------ | ----------------------------------- | ---------------------------------------------- | --- | ---- |
| AWS CDK              | [Y](./src/nodejs/README.md#aws-cdk)              |        | [Y](./src/dotnet/README.md#aws-cdk) | [Y](./src/java/README.md#aws-cdk)              |  [Y](./src/go/README.md#aws-cdk)   | [Y](./src/rust/README.md#aws-cdk)     |
| AWS SAM              | [Y](./src/nodejs/README.md#aws-sam)              |        | [Y](./src/dotnet/README.md#aws-sam)                                    | [Y](./src/java/README.md#aws-sam)              | [Y](./src/go/README.md#aws-sam)    | [Y](./src/rust/README.md#aws-sam)     |
| Terraform            | [Y](./src/nodejs/README.md#terraform)            |        | [Y](./src/dotnet/README.md#terraform)                                    | [Y](./src/java/README.md#terraform)            |  [Y](./src/go/README.md#terraform)   | [Y](./src/rust/README.md#terraform)     |
| Serverless Framework | [Y](./src/nodejs/README.md#serverless-framework) |        |  [N](./src/dotnet/README.md#serverless-framework)                                   | [Y](./src/java/README.md#serverless-framework) |     |      |
| SST v2               | [Y](./src/nodejs/README.md#serverless-stack-sst) |        |                                     |                                                |     |      |

## End to End Tracing Output

Once deployed, the system demonstrates the full end to end observability Datadog provides. Including automatic trace propagation through multiple asynchronous message channels, backend services and demonstrates [`SpanLinks`](https://docs.datadoghq.com/tracing/trace_collection/span_links/).

![End to end tracing](img/end-to-end-trace.png)

The application simulates `Product`, `Inventory` and `Analytics` services, inside an eCommerce application. The functionality is managed by three independent teams, the product service, inventory service and analytics service team. Interactions between domains runs through a shared Amazon EventBridge EventBus.

## Demo Application

### Product Service

The product service is made up of 3 independent services, that interact asynchronously.

1. The `ProductAPI` provides CRUD (Create, Read, Update, Delete) API provides the ability to manage product information. On all CUD requests, private events are published onto respective SNS topics for downstream processing. The API has one additional Lambda function reacting to `PricingChanged` events published by the `ProductPricingService`.
2. The `ProductPricingService`. This service consumers `ProductCreated` and `ProductUpdated` events published by the `ProductAPI` and asynchronously calculates pricing discounts for the product. On calculation, it publishes a `PricingChanged` event onto another SNS topic which the `ProductAPI` then consumers to update pricing
3. The `PublicEventPublisher` acts as a translation layer between private and public events. It takes the `ProductCreated`, `ProductUpdated` and `ProductDeleted` events and translates them into the respective events for downstream processing.

### Inventory Service

The inventory service is made up of 2 independent services, that interact asynchronously.

1. The `InventoryAntiCorruptionLayer` acts as an anti-corruption layer. It receives requests from upstream services, ensures they are semantically correct against the expected schema and translates them for further processing inside the `InventorySevice`. This step also acts as a buffer, to prevent overload from upstream services.
2. The `StockOrderingService` takes upstream events and starts a StepFunctions workflow to start the processing of purchasing stock for the product

### Analytics Service

The analytics service is made up of a single service that recevies all events from `EventBridge` and increments a metric inside Datadog depending on the type of event received. The analytics service also demonstrates the use of [`SpanLinks`](https://docs.datadoghq.com/tracing/trace_collection/span_links/). SpanLinks are useful when two processes are related but don't have a direct parent-child relationship.

In this scenario, analytics spans would add noise to the end to end trace for the product creation and inventory ordering flow. However, causality is still useful to understand. Span Links provide a link, but still keeps independence in the traces.

## Load Tests

The repository also includes load-test configuration using [Artillery](https://www.artillery.io). You can use this to generate load into the product service, and view the downstream data in Datadog.

**NOTE** The load test runs for roughly 3 minutes, and will generate load into both your AWS and Datadog accounts. Use with caution to avoid billing. As an alternative, a [Postman Collection](./serverless-sample-app.postman_collection.json) is available that you can use to run test manually. Or you can use the integration tests documented in the respective languages folder.

To execute the loadtests, first ensure [Artillery is installed](https://www.artillery.io/docs/get-started/get-artillery). You will also need to set the `API_ENDPOINT` environment variable.

```sh
cd loadtest
export API_ENDPOINT=
artillery run loadtest.yml
```
