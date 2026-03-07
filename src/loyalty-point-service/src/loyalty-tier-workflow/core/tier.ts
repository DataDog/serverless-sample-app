//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

export enum Tier {
  Bronze = "Bronze",
  Silver = "Silver",
  Gold = "Gold",
  Platinum = "Platinum",
}

export const TIER_THRESHOLDS: Record<Tier, number> = {
  [Tier.Bronze]: 0,
  [Tier.Silver]: 500,
  [Tier.Gold]: 1500,
  [Tier.Platinum]: 3000,
};

export function evaluateTier(points: number): Tier {
  if (points >= TIER_THRESHOLDS[Tier.Platinum]) {
    return Tier.Platinum;
  }
  if (points >= TIER_THRESHOLDS[Tier.Gold]) {
    return Tier.Gold;
  }
  if (points >= TIER_THRESHOLDS[Tier.Silver]) {
    return Tier.Silver;
  }
  return Tier.Bronze;
}

export interface TierChange {
  hasChanged: boolean;
  previousTier: Tier;
  newTier: Tier;
}

const TIER_ORDER = [Tier.Bronze, Tier.Silver, Tier.Gold, Tier.Platinum];

export function evaluateTierChange(
  currentPoints: number,
  currentTier: Tier
): TierChange {
  const newTier = evaluateTier(currentPoints);
  const isUpgrade = TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(currentTier);
  return {
    hasChanged: isUpgrade,
    previousTier: currentTier,
    newTier,
  };
}
