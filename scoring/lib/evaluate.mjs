// Everything the report and the sign-off sheet show, computed once.

import { inWindow, isScorable, windowDeals } from "./dataset.mjs";
import { bands, cutoffSweep, rate, summarize, tierTable } from "./metrics.mjs";
import { scoreDeals, toEngineConfig } from "./rubric.mjs";

const TIER_NAMES = ["tier_1", "tier_2", "tier_3"];

// Ops sees every lead, not just those with a recorded call outcome, so tiers
// also report completion over all leads whose 30 days are up.
function allLeadRates(engineConfig, deals, window) {
  const mature = deals.filter((deal) => deal.is_outcome_mature === true && inWindow(deal, window));
  const rows = scoreDeals(engineConfig, mature);

  return Object.fromEntries(
    TIER_NAMES.map((name) => {
      const inTier = rows.filter((row) => row.tier === name);
      return [name, { n: inTier.length, rate: rate(inTier) }];
    })
  );
}

function evaluateWindow(engineConfig, deals, window) {
  const rows = scoreDeals(engineConfig, windowDeals(deals, window));
  const allLeads = allLeadRates(engineConfig, deals, window);

  return {
    summary: summarize(rows),
    tiers: tierTable(rows, TIER_NAMES).map((tier) => ({ ...tier, allLeads: allLeads[tier.tier] })),
    forced: rows.filter((row) => row.forced).length,
    rows,
  };
}

export function evaluate({ spec, rubric, legacy, deals }) {
  const engineConfig = toEngineConfig(rubric, spec);
  const legacyConfig = toEngineConfig(legacy);
  const { baseline, test } = spec.windows;

  const candidate = {
    baseline: evaluateWindow(engineConfig, deals, baseline),
    test: evaluateWindow(engineConfig, deals, test),
  };

  const current = {
    baseline: evaluateWindow(legacyConfig, deals, baseline),
    test: evaluateWindow(legacyConfig, deals, test),
  };

  // The legacy rubric run through the new engine must reproduce the score the
  // browser stored at submit time, or nothing else in the report can be trusted.
  const stored = deals.filter((deal) => deal.stored_score !== null && deal.stored_score !== undefined);
  const legacyOnStored = scoreDeals(legacyConfig, stored);
  const parity = {
    n: stored.length,
    scoreMatches: legacyOnStored.filter((row, i) => row.score === stored[i].stored_score).length,
    tierMatches: legacyOnStored.filter((row, i) => row.tier === stored[i].stored_tier).length,
  };

  const tier1 = rubric.tiers.find((tier) => tier.name === "tier_1").minScore;
  const tier1Test = candidate.test.tiers.find((tier) => tier.tier === "tier_1");

  return {
    spec,
    rubric,
    legacy,
    parity,
    candidate,
    current,
    sweep: {
      baseline: cutoffSweep(candidate.baseline.rows),
      test: cutoffSweep(candidate.test.rows),
    },
    bands: bands(candidate.test.rows),
    verdict: {
      tier1Cutoff: tier1,
      tier1TestRate: tier1Test.rate,
      meetsTarget: tier1Test.rate >= spec.targets.tier1MinRate,
    },
    scorableTotal: deals.filter(isScorable).length,
  };
}
