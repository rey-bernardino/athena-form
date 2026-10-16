#!/usr/bin/env node
// Evaluate a rubric on the baseline and test windows and write the HTML report
// and the Growth sign-off sheet to scoring/reports/.
//
// Usage: node scoring/report.mjs [--rubric path] [--dataset path] [--spec path]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { loadDataset } from "./lib/dataset.mjs";
import { evaluate } from "./lib/evaluate.mjs";
import { renderReport } from "./lib/report-html.mjs";
import { renderSignoff } from "./lib/signoff-md.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);

function parseArgs(argv) {
  const args = {
    dataset: path.join(ROOT, ".sandbox/lead_tier_project/data/lead_tier_dataset.json"),
    spec: path.join(HERE, "spec.json"),
    legacy: path.join(HERE, "rubrics", "legacy_b102.json"),
    rubric: null,
  };

  for (let i = 0; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, "")] = argv[i + 1];
  }

  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const spec = readJson(args.spec);
  const rubric = readJson(args.rubric || path.join(HERE, "rubrics", `${spec.name}.json`));
  const legacy = readJson(args.legacy);
  const { deals } = loadDataset(args.dataset);

  const evaluation = evaluate({ spec, rubric, legacy, deals });

  const outDir = path.join(HERE, "reports");
  fs.mkdirSync(outDir, { recursive: true });

  const htmlPath = path.join(outDir, `${rubric.name}.html`);
  const signoffPath = path.join(outDir, `${rubric.name}.signoff.md`);
  fs.writeFileSync(htmlPath, renderReport(evaluation));
  fs.writeFileSync(signoffPath, renderSignoff(evaluation));

  const { candidate, current, parity, verdict } = evaluation;
  console.log(`Engine parity: ${parity.scoreMatches}/${parity.n} stored scores reproduced`);
  console.log(`Test AUC ${candidate.test.summary.auc.toFixed(3)} (current rubric ${current.test.summary.auc.toFixed(3)})`);
  candidate.test.tiers.forEach((tier) => {
    console.log(`  ${tier.tier}: ${(100 * tier.share).toFixed(0)}% of leads, ${(100 * tier.rate).toFixed(1)}% completion`);
  });
  console.log(`Tier 1 goal ${verdict.meetsTarget ? "MET" : "MISSED"}`);
  console.log(`Wrote ${path.relative(ROOT, htmlPath)} and ${path.relative(ROOT, signoffPath)}`);

  if (parity.scoreMatches !== parity.n) process.exitCode = 1;
}

main();
