import * as https from "https";
import * as zlib from "zlib";
import { tracer } from "dd-trace";

/**
 * Configuration for the Datadog Transaction Tracker.
 * All values can be overridden via constructor; otherwise they fall back to environment variables.
 */
export interface DatadogTransactionTrackerConfig {
  /** Datadog API key (default: DD_API_KEY env var) */
  apiKey?: string;
  /** Datadog site hostname, e.g. "us3.datadoghq.com" (default: DD_SITE env var) */
  site?: string;
  /** Service name producing these events (default: DD_SERVICE env var or "rms") */
  service?: string;
  /** Deployment environment, e.g. "prod" or "local" (default: DD_ENV env var or "local") */
  env?: string;
}

/**
 * A single transaction to be sent to the pipeline_stats endpoint.
 * Represents a tracked unit of work at a specific pipeline checkpoint.
 */
export interface Transaction {
  /** Unique identifier for this transaction */
  transactionId: string;
  /** Name of the pipeline stage being recorded */
  checkpoint: string;
  /** Wall-clock time in nanoseconds when the checkpoint fired (optional; defaults to now) */
  timestampNanos?: string;
}

/**
 * Result of a send operation to the pipeline_stats API.
 */
export interface SendResult {
  /** HTTP status code (202 = Accepted on success) */
  statusCode: number;
  /** Response body from the server */
  body: string;
  /** True if statusCode is 202 */
  success: boolean;
}

/**
 * Reusable helper for sending transaction tracking events to the Datadog pipeline_stats API.
 * Used to track data pipeline transactions through checkpoints for end-to-end latency monitoring.
 *
 * Environment variables (used when not overridden by config):
 *   DD_API_KEY  — Required. Datadog API key for authentication.
 *   DD_SITE     — Datadog site hostname (default: "us3.datadoghq.com").
 *   DD_SERVICE  — Service name (default: "rms").
 *   DD_ENV      — Environment (default: "local").
 */
export class DatadogTransactionTracker {
  private readonly apiKey: string;
  private readonly site: string;
  private readonly service: string;
  private readonly env: string;
  private readonly url: string;

  constructor(config: DatadogTransactionTrackerConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.DD_API_KEY ?? "";
    this.site = config.site ?? process.env.DD_SITE ?? "us3.datadoghq.com";
    this.service = config.service ?? process.env.DD_SERVICE ?? "rms";
    this.env = config.env ?? process.env.DD_ENV ?? "local";
    this.url = `https://trace.agent.${this.site}/api/v0.1/pipeline_stats`;
  }

  /**
   * Send one or more transactions to the pipeline_stats endpoint.
   * Payload is JSON-encoded and gzip-compressed as required by the API.
   * Sets dsm.transaction_id and dsm.transaction.checkpoint on the active span when present.
   */
  async send(transactions: Transaction[]): Promise<SendResult> {
    if (this.apiKey === "") {
      throw new Error("DD_API_KEY is required for Datadog Transaction Tracking");
    }

    if (transactions.length === 0) {
      throw new Error("At least one transaction is required");
    }

    this.setSpanTagsFromTransaction(transactions[0]);

    const nowNanos = this.toTimestampNanos(Date.now());
    const apiTransactions = transactions.map((t) => ({
      transaction_id: t.transactionId,
      checkpoint: t.checkpoint,
      timestamp_nanos: t.timestampNanos ?? nowNanos,
    }));

    const payload = {
      transactions: apiTransactions,
      service: this.service,
      environment: this.env,
    };

    const jsonPayload = Buffer.from(JSON.stringify(payload), "utf8");
    const gzipPayload = zlib.gzipSync(jsonPayload);

    const parsedUrl = new URL(this.url);
    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
        "DD-API-KEY": this.apiKey,
        "Content-Length": String(gzipPayload.length),
      },
    };

    return new Promise<SendResult>((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          resolve({
            statusCode: res.statusCode ?? 0,
            body,
            success: res.statusCode === 202,
          });
        });
      });

      req.on("error", reject);
      req.write(gzipPayload);
      req.end();
    });
  }

  /**
   * Convenience method to send a single transaction.
   */
  async sendSingle(transactionId: string, checkpoint: string): Promise<SendResult> {
    return this.send([{ transactionId, checkpoint }]);
  }

  /**
   * Convert milliseconds to nanoseconds string.
   * Uses BigInt to avoid floating-point precision loss.
   */
  private toTimestampNanos(ms: number): string {
    return String(BigInt(ms) * 1_000_000n);
  }

  /**
   * Sets DSM span attributes on the active span from the given transaction.
   */
  private setSpanTagsFromTransaction(transaction: Transaction): void {
    const span = tracer.scope().active();
    if (span) {
      span.addTags({
        "dsm.transaction_id": transaction.transactionId,
        "dsm.transaction.checkpoint": transaction.checkpoint,
      });
    }
  }
}
