//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { v4 as uuidv4 } from "uuid";
import axios from "axios";

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { SFNClient, ListStateMachinesCommand, ListExecutionsCommand } from "@aws-sdk/client-sfn";
import { ApiDriver } from "./apiDriver";

let apiDriver: ApiDriver
let stepFunctionsClient: SFNClient;
let stepFunctionArn = "";

// Running tests that span the full end to end, across multiple backend services is not a best practice, this test is to make sure the example app works when updated.
describe("end-to-end-tests", () => {
  beforeAll(async () => {
    if (process.env.API_ENDPOINT !== undefined) {
      apiDriver = new ApiDriver(process.env.API_ENDPOINT);
      return;
    }

    const ssmCLient = new SSMClient();
    const parameter = await ssmCLient.send(
      new GetParameterCommand({
        Name: "/node/product/api-endpoint",
      })
    );
    apiDriver = new ApiDriver(parameter.Parameter!.Value!);

    stepFunctionsClient = new SFNClient();
    const allStepFunctions = await stepFunctionsClient.send(
      new ListStateMachinesCommand({})
    )

    const nodeStepFunction = allStepFunctions.stateMachines?.filter(stateMachine => stateMachine.name?.startsWith("Node"));

    if (nodeStepFunction === undefined || nodeStepFunction.length === 0) {
     throw new Error("Node Step Function not found")
    };
    stepFunctionArn = nodeStepFunction[0].stateMachineArn!;
  });

  it("should be able to run through entire product lifecycle, CRUD", async () => {
    const testStart = new Date();
    const testProductName = uuidv4();
    const createProductResult = await apiDriver.createProduct(testProductName, 12.99);

    expect(createProductResult.status).toBe(201);
    expect(createProductResult.data.data.productId).toBe(
      testProductName.toUpperCase()
    );

    const productId = createProductResult.data.data.productId;
    console.log(`ProductID is ${productId}`);

    const listProductResult = await apiDriver.listProducts();

    expect(listProductResult.status).toBe(200);

    let getProductResult = await apiDriver.getProduct(productId);

    expect(getProductResult.status).toBe(200);
    expect(getProductResult.data.data!.name).toBe(testProductName);
    expect(getProductResult.data.data!.price).toBe(12.99);

    const updateProductResult = await apiDriver.updateProduct(productId, "New Name", 50);

    expect(updateProductResult.status).toBe(200);
    expect(updateProductResult.data.data.name).toBe("New Name");
    expect(updateProductResult.data.data.price).toBe(50);

    // Let async processes run
    await delay(5000);

    getProductResult = await apiDriver.getProduct(productId);

    expect(getProductResult.data.data!.pricingBrackets.length).toBe(5);

    const deleteProductResult = await apiDriver.deleteProduct(productId);

    expect(deleteProductResult.status).toBe(200);

    try {
      await apiDriver.getProduct(productId);
    } catch (error: any) {
      expect(error.response.status).toBe(404);
    }

    const stepFunctionExecutions = await stepFunctionsClient.send(new ListExecutionsCommand({
      stateMachineArn: stepFunctionArn
    }));

    const recentExecution = stepFunctionExecutions.executions?.filter(execution => execution.startDate! > testStart);

    expect(recentExecution?.length).toBe(1)

  }, 20000);
});

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

class ProductDTO {
  productId: string;
  name: string;
  price: number;
  pricingBrackets: {
    quantity: number;
    price: number;
  }[];
}

class HandlerResponse<T> {
  data: T | undefined;
  message: string[];
  success: boolean;
}