import assert from "node:assert/strict";
import { test } from "node:test";

import { auc, cutoffSweep } from "../lib/metrics.mjs";
import { chooseCutoffs } from "../lib/tiers.mjs";

const rows = (pairs) => pairs.map(([score, y]) => ({ score, y }));

test("auc is 1 for a perfect ranking, 0.5 for all ties", () => {
  assert.equal(auc(rows([[1, 0], [2, 0], [3, 1], [4, 1]])), 1);
  assert.equal(auc(rows([[5, 0], [5, 1], [5, 0], [5, 1]])), 0.5);
});

test("auc counts ties as half", () => {
  // Pairs (pos, neg): (2 vs 1) win, (2 vs 2) tie -> (1 + 0.5) / 2.
  assert.equal(auc(rows([[1, 0], [2, 0], [2, 1]])), 0.75);
});

test("cutoff sweep splits at score >= cutoff", () => {
  const sweep = cutoffSweep(rows([[10, 0], [20, 1], [30, 1]]), 30);

  assert.equal(sweep[20].nAbove, 2);
  assert.equal(sweep[20].rateAbove, 1);
  assert.equal(sweep[20].rateBelow, 0);
});

test("tier 1 is the widest group meeting the target, tier 3 the widest below its ceiling", () => {
  const data = [];
  for (let score = 0; score <= 100; score++) {
    for (let i = 0; i < 20; i++) data.push({ score, y: i < score / 5 ? 1 : 0 });
  }

  const targets = { tier1MinRate: 0.7, tier3MaxRate: 0.1, minTierDeals: 50 };
  const { tier1, tier3 } = chooseCutoffs(data, targets);
  const sweep = cutoffSweep(data);

  assert.ok(sweep[tier1].rateAbove >= 0.7);
  assert.ok(sweep[tier1 - 1].rateAbove < 0.7);
  assert.ok(sweep[tier3].rateBelow <= 0.1);
  assert.ok(sweep[tier3 + 1].rateBelow > 0.1);
});
