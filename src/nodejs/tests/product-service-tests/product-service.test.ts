//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { v4 as uuidv4 } from "uuid";
import exp = require("constants");
import axios from "axios";
import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";

let apiEndpoint = "";

describe("product-service-tests", () => {
  beforeAll(async () => {
    if (process.env.API_ENDPOINT !== undefined){
      apiEndpoint = process.env.API_ENDPOINT;
      return;
    }
    
    const cfnClient = new CloudFormationClient();
    const stackName =
      process.env.PRODUCT_API_STACK_NAME ?? "NodeProductApiStack";
    const stack = await cfnClient.send(
      new DescribeStacksCommand({
        StackName: stackName,
      })
    );
    if (stack.Stacks === undefined) {
      throw `Stack '${stackName}' not found`;
    }
    const outputs = stack.Stacks[0].Outputs;
    apiEndpoint = outputs?.filter(
      (output) => output.ExportName === "NodeProductApiEndpoint"
    )[0].OutputValue!;
  });

  it("should be able to run through entire product lifecycle, CRUD", async () => {
    const testProductName = uuidv4();
    const createProductResult = await axios.post(`${apiEndpoint}/product`, {
      name: testProductName,
      price: 12.99,
    });

    expect(createProductResult.status).toBe(201);
    expect(createProductResult.data.data.productId).toBe(
      testProductName.toUpperCase()
    );

    const productId = createProductResult.data.data.productId;

    const getProductResult = await axios.get(
      `${apiEndpoint}/product/${productId}`
    );

    expect(getProductResult.status).toBe(200);
    expect(getProductResult.data.data.name).toBe(testProductName);
    expect(getProductResult.data.data.price).toBe(12.99);

    const updateProductResult = await axios.put(`${apiEndpoint}/product`, {
      productId,
      name: "New name",
      price: 15.99,
    });

    expect(updateProductResult.status).toBe(200);
    expect(updateProductResult.data.data.name).toBe("New name");
    expect(updateProductResult.data.data.price).toBe(15.99);

    const deleteProductResult = await axios.delete(
      `${apiEndpoint}/product/${productId}`
    );

    expect(deleteProductResult.status).toBe(200);

    try {
      const postDeleteGetProductResult = await axios.get(
        `${apiEndpoint}/product/${productId}`
      );
    } catch (error: any) {
      expect(error.response.status).toBe(404);
    }
  }, 15000);
});
