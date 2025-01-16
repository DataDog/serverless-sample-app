//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { Product } from "../core/product";
import { ProductRepository } from "../core/productRepository";

export class DynamoDbProductRepository implements ProductRepository {
  private client: DynamoDBClient;

  constructor(client: DynamoDBClient) {
    this.client = client;
  }
  async getProducts(): Promise<Product[]> {
    const scanResponse = await this.client.send(
      new ScanCommand({
        TableName: process.env.TABLE_NAME,
      })
    );

    const products =
      scanResponse.Items?.map((item) => {
        let product = new Product(
          item["Name"].S!,
          parseFloat(item["Price"].N!)
        );
        product.productId = item["ProductId"].S!;
        product.priceBrackets = JSON.parse(item["PriceBrackets"].S!);

        const stockLevelAttribute = item["StockLevel"];
        product.currentStockLevel =
          stockLevelAttribute === undefined
            ? 0
            : parseFloat(stockLevelAttribute.N ?? "0.00");

        return product;
      }) ?? [];

    return products;
  }

  async getProduct(productId: string): Promise<Product | undefined> {
    const getItemResponse = await this.client.send(
      new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          PK: {
            S: productId,
          },
        },
      })
    );

    if (getItemResponse.Item === undefined) {
      return undefined;
    }

    let product = new Product(
      getItemResponse.Item["Name"].S!,
      parseFloat(getItemResponse.Item["Price"].N!)
    );
    product.productId = getItemResponse.Item["ProductId"].S!;
    product.priceBrackets = JSON.parse(
      getItemResponse.Item["PriceBrackets"].S!
    );
    const stockLevelAttribute = getItemResponse.Item["StockLevel"];

    product.currentStockLevel =
      stockLevelAttribute === undefined
        ? 0
        : parseFloat(stockLevelAttribute.N ?? "0.00");

    return product;
  }

  async createProduct(product: Product): Promise<Product> {
    await this.client.send(
      new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          PK: {
            S: product.productId,
          },
          Type: {
            S: "Product",
          },
          Name: {
            S: product.name,
          },
          Price: {
            N: product.price.toFixed(2),
          },
          ProductId: {
            S: product.productId,
          },
          PriceBrackets: {
            S: JSON.stringify(product.priceBrackets),
          },
          StockLevel: {
            N: product.currentStockLevel.toFixed(2),
          },
        },
      })
    );

    return product;
  }
  async updateProduct(product: Product): Promise<Product> {
    await this.client.send(
      new PutItemCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          PK: {
            S: product.productId,
          },
          Type: {
            S: "Product",
          },
          Name: {
            S: product.name,
          },
          Price: {
            N: product.price.toFixed(2),
          },
          ProductId: {
            S: product.productId,
          },
          PriceBrackets: {
            S: JSON.stringify(product.priceBrackets),
          },
          StockLevel: {
            N: product.currentStockLevel.toFixed(2),
          },
        },
      })
    );

    return product;
  }
  async deleteProduct(productId: string): Promise<boolean> {
    await this.client.send(
      new DeleteItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          PK: {
            S: productId,
          },
        },
      })
    );

    return true;
  }
}
