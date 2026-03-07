//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { Tier } from "./tier";

export interface TierRepository {
  getForUser(userId: string): Promise<{ tier: Tier; tierVersion: number } | null>;
  save(
    userId: string,
    tier: Tier,
    pointsAtUpgrade: number,
    currentVersion: number
  ): Promise<void>;
  recordNotified(userId: string): Promise<void>;
}
