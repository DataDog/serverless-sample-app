import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import mcpServer from "./mcp-server.js";
import mcpErrors from "./mcp-errors.js";
import express, { RequestHandler } from "express";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({});

const MCP_PATH = "/mcp";

// Helper function to get raw body from request
const getRawBody = (
  req: express.Request,
  options: { limit: string; encoding: string }
): Promise<string> => {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    const limit = parseInt(options.limit.replace(/\D/g, "")) * 1024 * 1024; // Convert "1mb" to bytes

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body too large"));
        return;
      }
      body += chunk.toString(options.encoding as BufferEncoding);
    });

    req.on("end", () => {
      resolve(body);
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
};

const bootstrap = async (app: express.Express) => {
  app.post(MCP_PATH, postRequestHandler);
  app.get(MCP_PATH, sessionRequestHandler);
  app.delete(MCP_PATH, sessionRequestHandler);
};

const postRequestHandler = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    // Create new instances of MCP Server and Transport for each incoming request
    const newMcpServer = mcpServer.create();
    const transport = new StreamableHTTPServerTransport({
      // This is a stateless MCP server, so we don't need to keep track of sessions
      sessionIdGenerator: undefined,

      // Change to `false` if you want to enable SSE in responses.
      enableJsonResponse: true,
    });

    res.on("close", () => {
      logger.info("Response closed, cleaning up transport and MCP server.");

      transport.close();
      newMcpServer.close();
    });
    await newMcpServer.connect(transport);

    // This implementation manually reads the token and adds it to the arguments passed to the downstream MCP server
    // For a real implementation, you should use an OAuth provder as described in the docs - https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#proxy-authorization-requests-upstream
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    if (!req.body.params) {
      req.body.params = {};
    }
    req.body.params.arguments = {
      ...req.body.params.arguments,
      token: token || "",
    };

    logger.info(JSON.stringify(req.body));

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    logger.error(`Error handling MCP request ${err}`);
    if (!res.headersSent) {
      res.status(500).json(mcpErrors.internalServerError);
    }
  }
};

const sessionRequestHandler = async (
  req: express.Request,
  res: express.Response
) => {
  res.status(405).set("Allow", "POST").json(mcpErrors.methodNotAllowed);
};

export default {
  bootstrap,
};
