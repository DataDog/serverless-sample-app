//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Logger } from "@aws-lambda-powertools/logger";
import { PipelineCheckpointRecorder } from "../core/pipelineCheckpointRecorder";
import { DatadogTransactionTracker } from "../../observability/datadogTransactionTracker";

/**
 * Adapter that forwards pipeline checkpoints to the Datadog pipeline_stats API.
 * Failures are logged but not propagated so observability issues do not break the main flow.
 */
export class DatadogPipelineCheckpointRecorder implements PipelineCheckpointRecorder {
  private readonly tracker: DatadogTransactionTracker;
  private readonly logger: Logger;

  constructor(tracker?: DatadogTransactionTracker) {
    this.tracker = tracker ?? new DatadogTransactionTracker();
    this.logger = new Logger({ serviceName: process.env.DD_SERVICE });
  }

  async recordCheckpoint(transactionId: string, checkpoint: string): Promise<void> {
    try {
      const result = await this.tracker.sendSingle(transactionId, checkpoint);
      if (!result.success) {
        this.logger.warn(
          `Pipeline checkpoint failed: transactionId=${transactionId} checkpoint=${checkpoint} status=${result.statusCode}`
        );
      }
    } catch (error) {
      this.logger.warn(
        `Pipeline checkpoint error: transactionId=${transactionId} checkpoint=${checkpoint}`,
        { error }
      );
    }
  }
}
