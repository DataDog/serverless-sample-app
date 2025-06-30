import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { JwtPayload, verify } from "jsonwebtoken";

const logger = new Logger({});

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  const authToken = event.authorizationToken;
  if (!authToken) {
    logger.warn("No authorization token provided, returning deny");
    return generatePolicy("Deny", event.methodArn);
  }

  const parameter = await getParameter(process.env.JWT_SECRET_PARAM_NAME!);
  let verificationResult: JwtPayload | string = "";

  try {
    verificationResult = verify(
      event.authorizationToken!.replace("Bearer ", ""),
      parameter!
    );
  } catch (err: Error | any) {
    logger.warn("Unauthorized request", { error: err });

    return generatePolicy("Deny", event.methodArn);
  }

  if (verificationResult.length === 0) {
    return generatePolicy("Deny", event.methodArn);
  }

  return generatePolicy("Allow", event.methodArn);
};

const generatePolicy = (
  effect: "Allow" | "Deny",
  resource: string
): APIGatewayAuthorizerResult => {
  return {
    principalId: "user",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
};
