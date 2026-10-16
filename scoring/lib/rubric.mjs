// Turning a derived rubric plus the spec into an engine config, and scoring
// deals with it through the real engine.

import { scoreLead } from "../../src/features/scoring.engine.js";

import { outcome, toEngineInput } from "./dataset.mjs";

export function toEngineConfig(rubric, spec) {
  return {
    scale: rubric.scale,
    questions: rubric.questions,
    tiers: rubric.tiers || [],
    forceTierRules: spec?.forceTierRules ?? rubric.forceTierRules ?? [],
  };
}

export function scoreDeals(engineConfig, deals) {
  return deals.map((deal) => {
    const result = scoreLead(engineConfig, toEngineInput(deal));

    return {
      dealId: deal.deal_id,
      score: result.score,
      tier: result.tier,
      forced: Boolean(result.forcedTier),
      y: outcome(deal),
    };
  });
}
