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
import { RemovalPolicy } from "aws-cdk-lib";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";

export interface ApiProps {
  sharedProps: SharedProps;
  ddApiKeySecret: ISecret;
}

export class Api extends Construct {
  productCreatedTopic: ITopic;
  productUpdatedTopic: ITopic;
  productDeletedTopic: ITopic;
  api: RestApi;
  table: ITable;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    this.productCreatedTopic = new Topic(this, "NodeProductCreatedTopic");
    this.productUpdatedTopic = new Topic(this, "NodeProductUpdatedTopic");
    this.productDeletedTopic = new Topic(this, "NodeProductDeletedTopic");

    this.table = new Table(this, "TracedNodeTable", {
      tableName: `NodeProducts-${props.sharedProps.environment}`,
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
    const listProductIntegration = this.buildListProductsFunction(props.sharedProps);
    const createProductIntegration = this.buildCreateProductFunction(
      props.sharedProps
    );
    const updateProductIntegration = this.buildUpdateProductFunction(
      props.sharedProps
    );
    const deleteProductIntegration = this.buildDeleteProductFunction(
      props.sharedProps
    );


    this.api = new RestApi(this, "ProductRestNodeApi", {
      defaultCorsPreflightOptions: {
        allowOrigins: ["http://localhost:8080"],
        allowHeaders: ["*"],
        allowMethods: ["GET,PUT,POST,DELETE"]
      }
    });

    const productResource = this.api.root.addResource("product");
    productResource.addMethod("GET", listProductIntegration);
    productResource.addMethod("POST", createProductIntegration);
    productResource.addMethod("PUT", updateProductIntegration);

    const specificProductResource = productResource.addResource("{productId}");
    specificProductResource.addMethod("GET", getProductIntegration);
    specificProductResource.addMethod("DELETE", deleteProductIntegration);
  }

  buildListProductsFunction(props: SharedProps): LambdaIntegration {
    const listProductsFunction = new InstrumentedLambdaFunction(
      this,
      "ListProductsNodeFunction",
      {
        sharedProps: props,
        functionName: "ListProductsNodeFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          DOMAIN: "products"
        },
        buildDef: "./src/product-api/adapters/buildListProductsFunction.js",
        outDir: "./out/listProductsFunction",
      }
    );
    const listProductsIntegration = new LambdaIntegration(
      listProductsFunction.function
    );
    this.table.grantReadData(listProductsFunction.function);

    return listProductsIntegration;
  }

  buildGetProductFunction(props: SharedProps): LambdaIntegration {
    const getProductFunction = new InstrumentedLambdaFunction(
      this,
      "GetProductNodeFunction",
      {
        sharedProps: props,
        functionName: "GetProductNodeFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          DOMAIN: "products"
          
        },
        buildDef: "./src/product-api/adapters/buildGetProductFunction.js",
        outDir: "./out/getProductFunction",
      }
    );
    const getProductIntegration = new LambdaIntegration(
      getProductFunction.function
    );
    this.table.grantReadData(getProductFunction.function);

    return getProductIntegration;
  }

  buildCreateProductFunction(props: SharedProps): LambdaIntegration {
    const createProductFunction = new InstrumentedLambdaFunction(
      this,
      "CreateProductNodeFunction",
      {
        sharedProps: props,
        functionName: "CreateProductNodeFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          PRODUCT_CREATED_TOPIC_ARN: this.productCreatedTopic.topicArn,
          DOMAIN: "products"
        },
        buildDef: "./src/product-api/adapters/buildCreateProductFunction.js",
        outDir: "./out/createProductFunction",
      }
    );
    const createProductIntegration = new LambdaIntegration(
      createProductFunction.function
    );
    this.table.grantReadWriteData(createProductFunction.function);
    this.productCreatedTopic.grantPublish(createProductFunction.function);

    return createProductIntegration;
  }

  buildUpdateProductFunction(props: SharedProps): LambdaIntegration {
    const updateProductFunction = new InstrumentedLambdaFunction(
      this,
      "UpdateProductNodeFunction",
      {
        sharedProps: props,
        functionName: "UpdateProductNodeFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          PRODUCT_UPDATED_TOPIC_ARN: this.productUpdatedTopic.topicArn,
          DOMAIN: "products"
        },
        buildDef: "./src/product-api/adapters/buildUpdateProductFunction.js",
        outDir: "./out/updateProductFunction",
      }
    );
    const updateProductIntegration = new LambdaIntegration(
      updateProductFunction.function
    );
    this.table.grantReadWriteData(updateProductFunction.function);
    this.productUpdatedTopic.grantPublish(updateProductFunction.function);

    return updateProductIntegration;
  }

  buildDeleteProductFunction(props: SharedProps): LambdaIntegration {
    const deleteProductFunction = new InstrumentedLambdaFunction(
      this,
      "DeleteProductNodeFunction",
      {
        sharedProps: props,
        functionName: "DeleteProductNodeFunction",
        handler: "index.handler",
        environment: {
          TABLE_NAME: this.table.tableName,
          PRODUCT_DELETED_TOPIC_ARN: this.productDeletedTopic.topicArn,
          DOMAIN: "products"
        },
        buildDef: "./src/product-api/adapters/buildDeleteProductFunction.js",
        outDir: "./out/deleteProductFunction",
      }
    );
    const deleteProductIntegration = new LambdaIntegration(
      deleteProductFunction.function
    );
    this.table.grantReadWriteData(deleteProductFunction.function);
    this.productDeletedTopic.grantPublish(deleteProductFunction.function);

    return deleteProductIntegration;
  }
}
