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
import { use } from "dd-trace";

let apiDriver: ApiDriver;
let jwtSecretValue: string;
let asyncDelay = 5000;

describe("integration-tests", () => {
  beforeAll(async () => {
    if (
      process.env.API_ENDPOINT !== undefined &&
      process.env.EVENT_BUS_NAME !== undefined
    ) {
      apiDriver = new ApiDriver(
        process.env.API_ENDPOINT,
        process.env.EVENT_BUS_NAME!
      );
      return;
    }

    const env = process.env.ENV ?? "dev";
    const serviceName = "LoyaltyService";
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
    jwtSecretValue = jwtSecretParameter.Parameter!.Value!;

    const eventBusNameParam = await ssmCLient.send(
      new GetParameterCommand({
        Name: `/${env}/${sharedServiceName}/event-bus-name`,
      })
    );

    let apiEndpoint = apiEndpointParameter.Parameter!.Value!;
    if (apiEndpoint.endsWith("/")) {
      apiEndpoint = apiEndpoint.slice(0, -1);
    }

    // no-dd-sa:typescript-best-practices/no-console
    console.log(`API endpoint under test is: ${apiEndpoint}`);

    apiDriver = new ApiDriver(apiEndpoint, eventBusNameParam.Parameter?.Value!);
  });

  it("when user created, should be able to retrieve loyalty account", async () => {
    const testUserId = randomUUID().toString();
    await apiDriver.injectUserCreatedEvent(testUserId);

    await delay(asyncDelay);

    const bearerToken = generateJwt(jwtSecretValue!, testUserId);

    const loyaltyPoints = await apiDriver.getLoyaltyPoints(bearerToken);

    console.log(loyaltyPoints);
    expect(loyaltyPoints.userId).toBe(testUserId);
    expect(loyaltyPoints.currentPoints).toBe(100);
  }, 10000);

  it("when order completed, should be able to retrieve loyalty account", async () => {
    const testUserId = randomUUID().toString();
    const testOrderNumber = randomUUID().toString();
    await apiDriver.injectUserCreatedEvent(testUserId);

    await delay(asyncDelay);

    apiDriver.injectOrderCompletedEvent(testUserId, testOrderNumber);

    await delay(asyncDelay);

    const bearerToken = generateJwt(jwtSecretValue!, testUserId);

    const loyaltyPoints = await apiDriver.getLoyaltyPoints(bearerToken);
    console.log(loyaltyPoints);
    expect(loyaltyPoints.currentPoints).toBe(150);
  }, 20000);

  it("when order completed twice, should only add one set of points", async () => {
    const testUserId = randomUUID().toString();
    const testOrderNumber = randomUUID().toString();
    await apiDriver.injectUserCreatedEvent(testUserId);

    await delay(asyncDelay);

    apiDriver.injectOrderCompletedEvent(testUserId, testOrderNumber);
    apiDriver.injectOrderCompletedEvent(testUserId, testOrderNumber);

    await delay(asyncDelay);

    const bearerToken = generateJwt(jwtSecretValue!, testUserId);

    const loyaltyPoints = await apiDriver.getLoyaltyPoints(bearerToken);
    console.log(loyaltyPoints);
    expect(loyaltyPoints.currentPoints).toBe(150);
  }, 20000);

  function generateJwt(secretAccessKey: string, userId: string): string {
    var token = sign({}, secretAccessKey, {
      expiresIn: "1h",
      subject: userId,
    });

    return token;
  }
});

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
