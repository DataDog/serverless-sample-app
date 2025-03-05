//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

import { LoyaltyPoints } from "./loyaltyPoints";

export interface loyaltyPointRepository {
  forUser(userId: string): Promise<LoyaltyPoints | undefined>;
  save(loyaltyPoints: LoyaltyPoints): Promise<void>;
}
