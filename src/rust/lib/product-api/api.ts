//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import {
  AttributeType,
  BillingMode,
  ITable,
  Table,
  TableClass,
} from "aws-cdk-lib/aws-dynamodb";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { ITopic, Topic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { SharedProps } from "../constructs/sharedFunctionProps";
import { InstrumentedLambdaFunction } from "../constructs/lambdaFunction";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { RemovalPolicy } from "aws-cdk-lib";

export interface ApiProps {
  sharedProps: SharedProps;
  ddApiKeySecret: ISecret;
}

export class Api extends Construct {
  productCreatedTopic: ITopic;
  productUpdatedTopic: ITopic;
  productDeletedTopic: ITopic;
  api: HttpApi;
  table: ITable;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    this.productCreatedTopic = new Topic(this, "RustProductCreatedTopic");
    this.productUpdatedTopic = new Topic(this, "RustProductUpdatedTopic");
    this.productDeletedTopic = new Topic(this, "RustProductDeletedTopic");

    this.table = new Table(this, "TracedRustTable", {
      tableName: `RustProducts-${props.sharedProps.environment}`,
      tableClass: TableClass.STANDARD,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const getProductIntegration = this.buildGetProductFunction(
      props.sharedProps
    );
    const createProductIntegration = this.buildCreateProductFunction(
      props.sharedProps
    );
    const updateProductIntegration = this.buildUpdateProductFunction(
      props.sharedProps
    );
    const deleteProductIntegration = this.buildDeleteProductFunction(
      props.sharedProps
    );

    this.api = new HttpApi(this, "ProductRustApi");
    this.api.addRoutes({
      path: "/product/{productId}",
      methods: [HttpMethod.GET],
      integration: getProductIntegration,
    });
    this.api.addRoutes({
      path: "/product",
      methods: [HttpMethod.POST],
      integration: createProductIntegration,
    });
    this.api.addRoutes({
      path: "/product",
      methods: [HttpMethod.PUT],
      integration: updateProductIntegration,
    });
    this.api.addRoutes({
      path: "/product/{productId}",
      methods: [HttpMethod.DELETE],
      integration: deleteProductIntegration,
    });
  }

  buildGetProductFunction(props: SharedProps): HttpLambdaIntegration {
    const getProductFunction = new InstrumentedLambdaFunction(
      this,
      "GetProductRustFunction",
      {
        sharedProps: props,
        functionName: "GetProductRustFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          
        },
        manifestPath: "./src/product-api/lambdas/get_product/Cargo.toml"
      }
    );
    const getProductIntegration = new HttpLambdaIntegration(
      "GetProductFunctionIntegration",
      getProductFunction.function
    );
    this.table.grantReadData(getProductFunction.function);

    return getProductIntegration;
  }

  buildCreateProductFunction(props: SharedProps): HttpLambdaIntegration {
    const createProductFunction = new InstrumentedLambdaFunction(
      this,
      "CreateProductRustFunction",
      {
        sharedProps: props,
        functionName: "CreateProductRustFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          PRODUCT_CREATED_TOPIC_ARN: this.productCreatedTopic.topicArn,
        },
        manifestPath: "./src/product-api/lambdas/create_product/Cargo.toml"
      }
    );
    const createProductIntegration = new HttpLambdaIntegration(
      "CreateProductFunctionIntegration",
      createProductFunction.function
    );
    this.table.grantReadWriteData(createProductFunction.function);
    this.productCreatedTopic.grantPublish(createProductFunction.function);

    return createProductIntegration;
  }

  buildUpdateProductFunction(props: SharedProps): HttpLambdaIntegration {
    const updateProductFunction = new InstrumentedLambdaFunction(
      this,
      "UpdateProductRustFunction",
      {
        sharedProps: props,
        functionName: "UpdateProductRustFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          PRODUCT_UPDATED_TOPIC_ARN: this.productUpdatedTopic.topicArn,
        },
        manifestPath: "./src/product-api/lambdas/update_product/Cargo.toml"
      }
    );
    const updateProductIntegration = new HttpLambdaIntegration(
      "UpdateProductFunctionIntegration",
      updateProductFunction.function
    );
    this.table.grantReadWriteData(updateProductFunction.function);
    this.productUpdatedTopic.grantPublish(updateProductFunction.function);

    return updateProductIntegration;
  }

  buildDeleteProductFunction(props: SharedProps): HttpLambdaIntegration {
    const deleteProductFunction = new InstrumentedLambdaFunction(
      this,
      "DeleteProductRustFunction",
      {
        sharedProps: props,
        functionName: "DeleteProductRustFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          PRODUCT_DELETED_TOPIC_ARN: this.productDeletedTopic.topicArn,
        },
        manifestPath: "./src/product-api/lambdas/delete_product/Cargo.toml"
      }
    );
    const deleteProductIntegration = new HttpLambdaIntegration(
      "DeleteProductFunctionIntegration",
      deleteProductFunction.function
    );
    this.table.grantReadWriteData(deleteProductFunction.function);
    this.productDeletedTopic.grantPublish(deleteProductFunction.function);

    return deleteProductIntegration;
  }
}
