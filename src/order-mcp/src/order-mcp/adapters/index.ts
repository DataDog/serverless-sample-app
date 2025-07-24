import "./tracer"; // must come before importing any instrumented module.

import express from "express";
import transport from "./transport";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({});

const PORT = 3000;

// This function is using Lambda Web Adapter to run express.js on Lambda
// https://github.com/awslabs/aws-lambda-web-adapter
const app = express();

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
