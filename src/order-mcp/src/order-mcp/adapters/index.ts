import "./tracer"; // must come before importing any instrumented module.

import express from "express";
import transport from "./transport";
import { Logger } from "@aws-lambda-powertools/logger";
import { ProxyOAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";

const logger = new Logger({});

const PORT = 3000;
// This function is using Lambda Web Adapter to run express.js on Lambda
// https://github.com/awslabs/aws-lambda-web-adapter

const proxyProvider = new ProxyOAuthServerProvider({
  endpoints: {
    authorizationUrl: "https://auth.example.com/authorize",
    tokenUrl: "https://auth.example.com/token",
    revocationUrl: "https://auth.example.com/revoke",
  },
  getClient: async (client_id) => {
    return {
      client_id,
      redirect_uris: ["https://localhost:3000/callback"],
    };
  },
  verifyAccessToken: async (token) => {
    logger.info(`Verifying access token: ${token}`);
    return {
      token,
      clientId: "123",
      scopes: ["openid", "email", "profile"],
    };
  },
});

const app = express();

app.use(
  mcpAuthRouter({
    provider: proxyProvider,
    issuerUrl: new URL("https://auth.external.com"),
    baseUrl: new URL("https://mcp.example.com"),
    serviceDocumentationUrl: new URL("https://docs.example.com/"),
  })
);

app.use(express.json());

app.use(async (req, res, next) => {
  logger.info(`> ${req.method} ${req.originalUrl}`);
  return next();
});

transport
  .bootstrap(app)
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    logger.error("Error initializing MCP transport:", err);
    process.exit(1);
  });
