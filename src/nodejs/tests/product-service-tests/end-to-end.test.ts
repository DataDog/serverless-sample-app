//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import {
  SFNClient,
  ListStateMachinesCommand,
  ListExecutionsCommand,
} from "@aws-sdk/client-sfn";
import { ApiDriver } from "./apiDriver";
import { randomUUID } from "crypto";

let apiDriver: ApiDriver;
let stepFunctionsClient: SFNClient;
let stepFunctionArn = "";
const runtimeUnderTest = process.env.RUNTIME ?? "Node";
const environmentUnderTest = process.env.ENV ?? "test";
const testTimeout = runtimeUnderTest === "Java" ? 300000 : 90000;
const testDelay = runtimeUnderTest === "Java" ? 120000 : 30000;

// Running tests that span the full end to end, across multiple backend services is not a best practice, this test is to make sure the example app works when updated.
describe("end-to-end-tests", () => {
  beforeAll(async () => {
    if (process.env.API_ENDPOINT !== undefined) {
      apiDriver = new ApiDriver(process.env.API_ENDPOINT);
      return;
    }

    const ssmCLient = new SSMClient();
    stepFunctionsClient = new SFNClient();
    
    const parameter = await ssmCLient.send(
      new GetParameterCommand({
        Name: `/${runtimeUnderTest.toLowerCase()}/${environmentUnderTest.toLowerCase()}/product/api-endpoint`,
      })
    );

    // no-dd-sa:typescript-best-practices/no-console
    console.log(`API endpoint under test is: ${parameter.Parameter!.Value!}`);

    apiDriver = new ApiDriver(parameter.Parameter!.Value!);

    const stepFunctionParameter = await ssmCLient.send(
      new GetParameterCommand({
        Name: `/${runtimeUnderTest.toLowerCase()}/${environmentUnderTest.toLowerCase()}/inventory-ordering/state-machine-arn`,
      })
    );

    stepFunctionArn = stepFunctionParameter.Parameter!.Value!;

    // no-dd-sa:typescript-best-practices/no-console
    console.log(
      `StepFunction under test is ${stepFunctionParameter.Parameter!.Value!}`
    );
  });

  it(
    "should be able to run through entire product lifecycle, CRUD",
    async () => {
      const testStart = new Date();
      const testProductName = randomUUID().toString();
      const createProductResult = await apiDriver.createProduct(
        testProductName,
        12.99
      );

      expect([200, 201]).toContain(createProductResult.status);

      const productId = createProductResult.data.data.productId;

      // no-dd-sa:typescript-best-practices/no-console
      console.log(`ProductID is ${productId}`);

      const listProductResult = await apiDriver.listProducts();

      expect(listProductResult.status).toBe(200);

      let getProductResult = await apiDriver.getProduct(productId);

      expect(getProductResult.status).toBe(200);
      expect(getProductResult.data.data!.name).toBe(testProductName);
      expect(getProductResult.data.data!.price).toBe(12.99);

      const updateProductResult = await apiDriver.updateProduct(
        productId,
        "New Name",
        48
      );

      expect(updateProductResult.status).toBe(200);
      expect(updateProductResult.data.data.name).toBe("New Name");
      expect(updateProductResult.data.data.price).toBe(48);

      // Let async processes run
      await delay(testDelay);

      getProductResult = await apiDriver.getProduct(productId);

      expect(getProductResult.data.data!.pricingBrackets.length).toBe(5);

      const deleteProductResult = await apiDriver.deleteProduct(productId);

      expect(deleteProductResult.status).toBe(200);

      try {
        await apiDriver.getProduct(productId);
        // no-dd-sa:typescript-best-practices/no-explicit-any
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }

      const stepFunctionExecutions = await stepFunctionsClient.send(
        new ListExecutionsCommand({
          stateMachineArn: stepFunctionArn,
        })
      );

      const recentExecution = stepFunctionExecutions.executions?.filter(
        (execution) => execution.startDate! > testStart
      );

      expect(recentExecution?.length).toBe(1);
    },
    testTimeout
  ); // Extend test timeout for Java to account for slow cold starts
});

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
