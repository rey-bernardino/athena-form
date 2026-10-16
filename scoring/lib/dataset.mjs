// Loading and windowing the extracted lead tier dataset.

import fs from "fs";

import { normalizeValue } from "../../src/features/scoring.engine.js";

export function loadDataset(path) {
  if (!fs.existsSync(path)) {
    throw new Error(
      `Dataset not found at ${path}. Run scoring/extract_dataset.py first (see scoring/README.md).`
    );
  }

  return JSON.parse(fs.readFileSync(path, "utf8"));
}

export function inWindow(deal, [start, end]) {
  return deal.deal_created_date >= start && deal.deal_created_date <= end;
}

// Deals whose 30-day close call outcome is final and recorded. This is the
// population every rate, AUC and tier share in the report is measured on.
export function isScorable(deal) {
  return deal.is_outcome_mature === true && deal.is_cc_eligible === true;
}

export function outcome(deal) {
  return deal.is_cc_completed_30d === true ? 1 : 0;
}

export function windowDeals(deals, window) {
  return deals.filter((deal) => isScorable(deal) && inWindow(deal, window));
}

// The engine input for one historical deal. Historically every shown step had
// to be answered to advance, so "asked" is exactly "answered" here.
export function toEngineInput(deal) {
  return {
    answers: deal.answers || {},
    askedFields: [],
    emailDomain: deal.email_domain || "",
  };
}

// Canonical option keys a deal selected for a spec question, with aliases
// applied the same way the engine applies them.
export function canonicalSelections(question, deal) {
  const aliases = new Map(
    Object.entries(question.aliases || {}).map(([raw, key]) => [normalizeValue(raw), normalizeValue(key)])
  );

  const keys = (deal.answers?.[question.field] || [])
    .map((value) => {
      const normalized = normalizeValue(value);
      return aliases.get(normalized) ?? normalized;
    })
    .filter(Boolean);

  return [...new Set(keys)];
}

// Whether an option key belongs to the live form's option set. Open questions
// (utm_medium) accept any value; everything else is restricted to the form.
export function isKnownOption(question, key) {
  if (question.openOptions) return true;

  return Object.keys(question.options || {}).some((option) => normalizeValue(option) === key);
}
