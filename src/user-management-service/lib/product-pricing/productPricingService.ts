//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Construct } from "constructs";
import { SharedProps } from "../constructs/sharedFunctionProps";
import { InstrumentedLambdaFunction } from "../constructs/lambdaFunction";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import {
  SnsEventSource,
} from "aws-cdk-lib/aws-lambda-event-sources";
import { ITopic, Topic } from "aws-cdk-lib/aws-sns";
import { Queue } from "aws-cdk-lib/aws-sqs";

export interface ProductPricingServiceProps {
  sharedProps: SharedProps;
  productCreatedTopic: ITopic;
  productUpdatedTopic: ITopic;
}

export class ProductPricingService extends Construct {
  productCreatedPricingFunction: IFunction;
  productUpdatedPricingFunction: IFunction;
  priceCalculatedTopic: ITopic;

  constructor(scope: Construct, id: string, props: ProductPricingServiceProps) {
    super(scope, id);

    this.priceCalculatedTopic = new Topic(this, "RustPriceCalculatedTopic", {
      topicName: `RustPriceCalculatedTopic-${props.sharedProps.environment}`,
    });

    this.productCreatedPricingFunction = new InstrumentedLambdaFunction(
      this,
      "RustProductCreatedPricingFunction",
      {
        sharedProps: props.sharedProps,
        functionName: `RustProductCreatedPricing-${props.sharedProps.environment}`,
        handler: "index.handler",
        environment: {
          PRICE_CALCULATED_TOPIC_ARN: this.priceCalculatedTopic.topicArn,
          DD_SERVICE_MAPPING: `lambda_sns:${this.priceCalculatedTopic.topicName}`,
        }, 
          manifestPath: "./src/product-pricing/lambdas/product_created_pricing_handler/Cargo.toml"
      }
    ).function;
    this.priceCalculatedTopic.grantPublish(this.productCreatedPricingFunction);

    const productPricingDeadLetterQueue = new Queue(
      this,
      "ProductPricingDeadLetterQueue",
      {
        queueName: `RustProductPricingDLQ-${props.sharedProps.environment}`,
      }
    );

    this.productCreatedPricingFunction.addEventSource(
      new SnsEventSource(props.productCreatedTopic, {
        deadLetterQueue: productPricingDeadLetterQueue,
      })
    );

    this.productUpdatedPricingFunction = new InstrumentedLambdaFunction(
      this,
      "RustProductUpdatedPricingFunction",
      {
        sharedProps: props.sharedProps,
        functionName: `RustProductUpdatedPricing-${props.sharedProps.environment}`,
        handler: "index.handler",
        environment: {
          PRICE_CALCULATED_TOPIC_ARN: this.priceCalculatedTopic.topicArn,
          DD_SERVICE_MAPPING: `lambda_sns:${this.priceCalculatedTopic.topicName}`,
        },
          manifestPath: "./src/product-pricing/lambdas/product_updated_pricing_handler/Cargo.toml"
      }
    ).function;
    this.priceCalculatedTopic.grantPublish(this.productUpdatedPricingFunction);

    const productUpdatedPricingDLQ = new Queue(
      this,
      "ProductUpdatedPricingDLQ",
      {
        queueName: `RustProductUpdatedPricingDLQ-${props.sharedProps.environment}`,
      }
    );

    this.productUpdatedPricingFunction.addEventSource(
      new SnsEventSource(props.productUpdatedTopic, {
        deadLetterQueue: productUpdatedPricingDLQ,
      })
    );
  }
}
