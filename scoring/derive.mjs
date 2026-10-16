#!/usr/bin/env node
// Derive a lead tier rubric from the extracted dataset and write it to
// scoring/rubrics/<name>.json.
//
// 1. Fit each method on the baseline minus its last month and score that last
//    month (validation). The method with the higher validation AUC wins, so
//    the choice never looks at the test window.
// 2. Refit the winner on the full baseline.
// 3. Choose tier cutoffs on the baseline scores against spec.targets.
//
// The test window is untouched here; scoring/report.mjs measures it.
//
// Usage: node scoring/derive.mjs [--dataset path] [--spec path] [--out path]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { loadDataset, windowDeals } from "./lib/dataset.mjs";
import { deriveRubric } from "./lib/derive.mjs";
import { auc } from "./lib/metrics.mjs";
import { scoreDeals, toEngineConfig } from "./lib/rubric.mjs";
import { chooseCutoffs, tiersFromCutoffs } from "./lib/tiers.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);

const METHODS = ["exam", "fitted"];

function parseArgs(argv) {
  const args = {
    dataset: path.join(ROOT, ".sandbox/lead_tier_project/data/lead_tier_dataset.json"),
    spec: path.join(HERE, "spec.json"),
    out: null,
  };

  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, "")] = argv[i + 1];
  }

  return args;
}

function dayBefore(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().slice(0, 10);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const spec = JSON.parse(fs.readFileSync(args.spec, "utf8"));
  const { deals, extractedOn } = loadDataset(args.dataset);
  const { baseline, validation } = spec.windows;

  const fitWindow = [baseline[0], dayBefore(validation[0])];
  const validationDeals = windowDeals(deals, validation);

  const selection = METHODS.map((method) => {
    const rubric = deriveRubric(spec, deals, { method, window: fitWindow });
    const rows = scoreDeals(toEngineConfig(rubric, spec), validationDeals);

    return { method, validationAuc: auc(rows) };
  });

  const best = selection.reduce((a, b) => (b.validationAuc > a.validationAuc ? b : a));
  const rubric = deriveRubric(spec, deals, { method: best.method, window: baseline });

  const baselineRows = scoreDeals(toEngineConfig(rubric, spec), windowDeals(deals, baseline));
  const cutoffs = chooseCutoffs(baselineRows, spec.targets);

  if (cutoffs.tier1 === null) {
    throw new Error(`No cutoff reaches the tier 1 target of ${spec.targets.tier1MinRate} on the baseline.`);
  }

  const output = {
    name: spec.name,
    form: spec.form,
    generatedFrom: { extractedOn, windows: spec.windows, targets: spec.targets },
    methodSelection: selection,
    ...rubric,
    tiers: tiersFromCutoffs(cutoffs),
    forceTierRules: spec.forceTierRules,
    routing: spec.routing,
  };

  const out = args.out || path.join(HERE, "rubrics", `${spec.name}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(output, null, 2)}\n`);

  selection.forEach(({ method, validationAuc }) => {
    console.log(`${method.padEnd(7)} validation AUC ${validationAuc.toFixed(3)}${method === best.method ? "  <- chosen" : ""}`);
  });
  console.log(`\n${rubric.questions.length} questions scored, ${rubric.unscored.length} not scored`);
  rubric.questions.forEach((question) => {
    console.log(`  ${String(question.maxPoints).padStart(2)}  ${question.label}`);
  });
  console.log(`\nTier cutoffs (baseline): tier 1 >= ${cutoffs.tier1}, tier 3 < ${cutoffs.tier3 ?? "none"}`);
  console.log(`Wrote ${path.relative(ROOT, out)}`);
}

main();
