//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

export class ConcurrentModificationError extends Error {
  readonly userId: string;

  constructor(userId: string) {
    super(`Concurrent modification detected for user ${userId}. Please retry.`);
    this.name = "ConcurrentModificationError";
    this.userId = userId;
  }
}
