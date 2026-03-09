//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

/**
 * Port for recording pipeline checkpoints. Used to track units of work through
 * pipeline stages for end-to-end latency monitoring. Implementations are
 * responsible for forwarding checkpoints to the appropriate observability backend.
 */
export interface PipelineCheckpointRecorder {
  recordCheckpoint(transactionId: string, checkpoint: string): Promise<void>;
}
