//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { ApiDriver } from "./apiDriver";
import { randomUUID } from "crypto";
import { sign } from "jsonwebtoken";

let apiDriver: ApiDriver;
let bearerToken: string = "";

// Running tests that span the full end to end, across multiple backend services is not a best practice, this test is to make sure the example app works when updated.
describe("end-to-end-tests", () => {
  beforeAll(async () => {
    if (
      process.env.API_ENDPOINT !== undefined &&
      process.env.BEARER_TOKEN !== undefined
    ) {
      apiDriver = new ApiDriver(
        process.env.API_ENDPOINT,
        process.env.BEARER_TOKEN!
      );
      return;
    }

    const env = process.env.ENV ?? "dev";
    const serviceName = "PricingService";
    const sharedServiceName =
      env === "dev" || env === "prod" ? "shared" : serviceName;

    const ssmCLient = new SSMClient();

    const apiEndpointParameter = await ssmCLient.send(
      new GetParameterCommand({
        Name: `/${env}/${serviceName}/api-endpoint`,
      })
    );

    const jwtSecretParameter = await ssmCLient.send(
      new GetParameterCommand({
        Name: `/${env}/${sharedServiceName}/secret-access-key`,
      })
    );

    bearerToken = generateJwt(jwtSecretParameter.Parameter!.Value!);

    // no-dd-sa:typescript-best-practices/no-console
    console.log(
      `API endpoint under test is: ${apiEndpointParameter.Parameter!.Value!}`
    );

    let apiEndpoint = apiEndpointParameter.Parameter!.Value!;
    if (apiEndpoint.endsWith("/")) {
      apiEndpoint = apiEndpoint.slice(0, -1);
    }

    apiDriver = new ApiDriver(apiEndpoint, bearerToken);
  });

  it("should be able to generate pricing", async () => {
    const testProductName = randomUUID().toString();
    const generatePricingResult = await apiDriver.generatePricing(
      testProductName,
      12.99
    );

    expect([200]).toContain(generatePricingResult.status);
    expect(generatePricingResult.data.length).toEqual(5);
  });

  function generateJwt(secretAccessKey: string): string {
    var token = sign({}, secretAccessKey, {
      expiresIn: "1h",
      subject: "testuser",
    });

    return token;
  }

  it("pricing between 95 & 100, should have long response time but success", async () => {
    const testStartTime = new Date().getTime();

    const testProductName = randomUUID().toString();
    const generatePricingResult = await apiDriver.generatePricing(
      testProductName,
      97
    );

    const resultTime = new Date().getTime();
    const timeDifferenceInSeconds = (resultTime - testStartTime) / 1000;

    console.log(timeDifferenceInSeconds);

    expect([200]).toContain(generatePricingResult.status);
    expect(generatePricingResult.data.length).toEqual(5);
    // Forced delays in the backend
    expect(timeDifferenceInSeconds).toBeGreaterThan(8);
  }, 10000);

  it("pricing between 90 & 95, should error", async () => {
    const testProductName = randomUUID().toString();
    const generatePricingResult = await apiDriver.generatePricing(
      testProductName,
      91.99
    );

    expect([502]).toContain(generatePricingResult.status);
  });
});
