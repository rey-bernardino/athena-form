// Choosing tier cutoffs from a score distribution.

import { cutoffSweep } from "./metrics.mjs";

// How many consecutive cutoffs must also meet the target, so a single noisy
// cutoff cannot qualify on its own.
const STABILITY_RUN = 5;

// Tier 1 is the widest "score >= cutoff" group whose completion rate meets the
// target. Tier 3 is the widest "score < cutoff" group whose completion rate
// stays at or below its ceiling. Forced tiers are excluded: they are not the
// score's doing.
export function chooseCutoffs(rows, targets) {
  const sweep = cutoffSweep(rows.filter((row) => !row.forced));
  const minDeals = targets.minTierDeals;

  const tier1 = sweep.find((point, index) => {
    const run = sweep.slice(index, index + STABILITY_RUN);

    return (
      point.nAbove >= minDeals &&
      run.every((next) => next.nAbove < minDeals || next.rateAbove >= targets.tier1MinRate)
    );
  });

  const tier3 = [...sweep].reverse().find((point) => {
    return (
      point.nBelow >= minDeals &&
      point.rateBelow <= targets.tier3MaxRate &&
      (!tier1 || point.cutoff < tier1.cutoff)
    );
  });

  return {
    tier1: tier1?.cutoff ?? null,
    tier3: tier3?.cutoff ?? null,
  };
}

export function tiersFromCutoffs({ tier1, tier3 }) {
  return [
    { name: "tier_1", minScore: tier1 },
    { name: "tier_2", minScore: tier3 ?? 0 },
    { name: "tier_3", minScore: 0 },
  ];
}
