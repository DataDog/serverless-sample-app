import {
  APIGatewayAuthorizerResult,
  Context,
} from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { JwtPayload, verify } from "jsonwebtoken";

const logger = new Logger({});

export const handler = async (
  event: any,
  context: Context
): Promise<APIGatewayAuthorizerResult> => {
  logger.info("Authorizer invoked", {
    requestId: context.awsRequestId,
    methodArn: event.methodArn,
  });

  const authToken = extractTokenFromHeaders(event.headers!);
  if (!authToken) {
    logger.warn("No authorization token provided, returning deny");
    return generatePolicy("Deny", event.methodArn);
  }

  const parameter = await getParameter(process.env.JWT_SECRET_PARAM_NAME!);
  let verificationResult: JwtPayload | string | undefined;

  try {
    verificationResult = verify(authToken, parameter!);
  } catch (err: Error | any) {
    logger.warn("Unauthorized request", { error: err });

    return generatePolicy("Deny", event.methodArn);
  }

  // `verify` returns a decoded JwtPayload object for valid signed tokens, or a
  // raw string for tokens without a structured payload. A valid token must be
  // a payload object carrying a `sub` (subject) claim.
  if (
    !verificationResult ||
    typeof verificationResult === "string" ||
    !verificationResult.sub
  ) {
    logger.warn("Token verification produced an invalid payload, returning deny");
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

const extractTokenFromHeaders = (
  headers: Record<string, string | undefined>
): string | null => {
  // Case-insensitive header lookup
  const authHeader = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === "authorization"
  )?.[1];

  if (!authHeader) {
    return null;
  }

  // Support both "Bearer token" and just "token" formats
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return authHeader;
};
