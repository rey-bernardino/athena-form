// Derive a lead scoring rubric from historical deals.
//
// Both methods share the within-question step: each option's 30-day completion
// rate is shrunk toward the window baseline, the worst well-populated option
// (minOptionN+) is graded 0 and the best 1, and everything between is linear.
// Smaller options (minGradeN+) are graded on their shrunk rate, clipped to the
// same range. Options thinner than that, and values the live form does not
// offer, sit at the question's neutral (volume-weighted average) grade, which
// is what the engine's defaultPoints do.
//
// The methods differ only in how much each question is worth:
//   exam    volume-weighted spread of the question's option rates. Each
//           question is judged on its own.
//   fitted  coefficients of an L2 logistic regression over all questions at
//           once, so two questions carrying the same signal (utm_medium and
//           "how did you hear about us" both see referrals) share its weight
//           instead of counting it twice.
// Either weight is then discounted for thin coverage.

import { normalizeValue } from "../../src/features/scoring.engine.js";

import { canonicalSelections, isKnownOption, outcome, windowDeals } from "./dataset.mjs";

function optionStats(question, deals, p0, settings) {
  const counts = new Map();

  deals.forEach((deal) => {
    canonicalSelections(question, deal)
      .filter((key) => isKnownOption(question, key))
      .forEach((key) => {
        const entry = counts.get(key) || { n: 0, completed: 0 };
        entry.n++;
        entry.completed += outcome(deal);
        counts.set(key, entry);
      });
  });

  return [...counts.entries()].map(([key, { n, completed }]) => ({
    key,
    n,
    rate: completed / n,
    shrunk: (completed + settings.shrinkK * p0) / (n + settings.shrinkK),
    anchors: n >= settings.minOptionN,
    kept: n >= settings.minGradeN,
  }));
}

function profileQuestion(question, deals, p0, settings) {
  const stats = optionStats(question, deals, p0, settings);
  const anchors = stats.filter((option) => option.anchors);

  if (anchors.length < 2) return null;

  const lo = Math.min(...anchors.map((option) => option.shrunk));
  const hi = Math.max(...anchors.map((option) => option.shrunk));
  const span = hi - lo || 1e-9;
  const toGrade = (shrunk) => Math.min(1, Math.max(0, (shrunk - lo) / span));

  const totalN = anchors.reduce((sum, option) => sum + option.n, 0);
  const pbar = anchors.reduce((sum, option) => sum + option.shrunk * option.n, 0) / totalN;
  const variance = anchors.reduce((sum, option) => sum + option.n * (option.shrunk - pbar) ** 2, 0) / totalN;

  const coverage = deals.filter((deal) => canonicalSelections(question, deal).length > 0).length;

  const grade = new Map(
    stats.filter((option) => option.kept).map((option) => [option.key, toGrade(option.shrunk)])
  );

  return {
    question,
    stats,
    grade,
    neutral: toGrade(pbar),
    coverage,
    reliability: Math.sqrt(coverage / (coverage + settings.reliabilityN0)),
    spread: Math.sqrt(variance),
  };
}

// A deal's 0..1 grade on one question, mirroring the engine: best selected
// option for multi-select, neutral for values without their own grade, and
// null when the question was not asked.
function gradeDeal(profile, deal) {
  const keys = canonicalSelections(profile.question, deal);

  if (!keys.length) return null;

  const grades = keys.map((key) => profile.grade.get(key) ?? profile.neutral);

  return profile.question.multi ? Math.max(...grades) : grades[0];
}

// Newton-Raphson for L2-penalized logistic regression. The intercept is not
// penalized. Small and dense: a few thousand rows by ~20 features.
export function fitLogistic(X, y, l2, iterations = 50) {
  const d = X[0].length + 1;
  let beta = new Array(d).fill(0);

  for (let iteration = 0; iteration < iterations; iteration++) {
    const gradient = new Array(d).fill(0);
    const hessian = Array.from({ length: d }, () => new Array(d).fill(0));

    X.forEach((row, i) => {
      const x = [1, ...row];
      const z = x.reduce((sum, value, j) => sum + value * beta[j], 0);
      const p = 1 / (1 + Math.exp(-z));
      const w = p * (1 - p);

      for (let j = 0; j < d; j++) {
        gradient[j] += (y[i] - p) * x[j];
        for (let k = j; k < d; k++) hessian[j][k] += w * x[j] * x[k];
      }
    });

    for (let j = 0; j < d; j++) {
      for (let k = 0; k < j; k++) hessian[j][k] = hessian[k][j];
      if (j > 0) {
        gradient[j] -= l2 * beta[j];
        hessian[j][j] += l2;
      }
    }

    const step = solve(hessian, gradient);
    beta = beta.map((value, j) => value + step[j]);

    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }

  return beta;
}

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
    }
  }

  return M.map((row, i) => row[n] / row[i]);
}

function fittedWeights(profiles, deals, l2) {
  const grades = deals.map((deal) => profiles.map((profile) => gradeDeal(profile, deal)));

  const means = profiles.map((_, j) => {
    const present = grades.map((row) => row[j]).filter((value) => value !== null);
    return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : 0;
  });

  const X = grades.map((row) => row.map((value, j) => (value === null ? means[j] : value)));
  const beta = fitLogistic(X, deals.map(outcome), l2);

  return beta.slice(1);
}

export function deriveRubric(spec, allDeals, { method, window }) {
  const settings = spec.derivation;
  const deals = windowDeals(allDeals, window);
  const p0 = deals.reduce((sum, deal) => sum + outcome(deal), 0) / deals.length;

  const profiles = spec.questions
    .map((question) => profileQuestion(question, deals, p0, settings))
    .filter(Boolean);

  // Both methods discount questions few leads were asked: a weight learned
  // from a few hundred answers is mostly noise.
  const rawWeights =
    method === "fitted"
      ? fittedWeights(profiles, deals, settings.l2)
      : profiles.map((profile) => profile.spread);

  const weights = rawWeights.map((weight, index) => weight * profiles[index].reliability);

  const maxWeight = Math.max(...weights.map((weight) => Math.max(0, weight))) || 1;

  const diagnostics = [];
  const questions = [];

  profiles.forEach((profile, index) => {
    const { question } = profile;
    const weight = Math.max(0, weights[index]);
    const cap = Math.round((settings.maxCap * weight) / maxWeight);

    const options = {};
    profile.stats
      .filter((option) => option.kept)
      .sort((a, b) => b.shrunk - a.shrunk)
      .forEach((option) => {
        options[formKey(question, option.key)] = Math.round(cap * profile.grade.get(option.key));
      });

    const defaultPoints = Math.round(cap * profile.neutral);

    diagnostics.push({
      field: question.field,
      label: question.label,
      coverage: profile.coverage,
      weight: weights[index],
      cap,
      defaultPoints,
      options: profile.stats
        .sort((a, b) => b.shrunk - a.shrunk)
        .map((option) => ({
          key: option.key,
          label: question.options?.[option.key] ?? labelFromKey(question, option.key),
          n: option.n,
          rate: option.rate,
          shrunk: option.shrunk,
          points: option.kept ? options[formKey(question, option.key)] : defaultPoints,
          kept: option.kept,
        })),
    });

    if (cap <= 0) return;

    questions.push({
      id: question.field,
      label: question.label,
      source: question.source,
      field: question.field,
      aggregate: question.multi ? "max" : "sum",
      maxPoints: cap,
      defaultPoints,
      ...(Object.keys(question.aliases || {}).length ? { aliases: question.aliases } : {}),
      options,
    });
  });

  const scoredFields = new Set(questions.map((question) => question.field));

  return {
    name: spec.name,
    method,
    derivedOn: window,
    baselineRate: p0,
    nDeals: deals.length,
    scale: "percent_of_asked",
    questions,
    diagnostics,
    unscored: spec.questions
      .filter((question) => !scoredFields.has(question.field))
      .map((question) => ({ field: question.field, label: question.label })),
  };
}

// The option key as the live form spells it ("Referral", not "referral"), so the
// generated config reads like the form. The engine matches case-insensitively.
function formKey(question, key) {
  return Object.keys(question.options || {}).find((option) => normalizeValue(option) === key) ?? key;
}

function labelFromKey(question, key) {
  const match = Object.entries(question.options || {}).find(([option]) => normalizeValue(option) === key);

  return match ? match[1] : key;
}
