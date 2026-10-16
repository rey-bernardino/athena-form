// src/features/scoring.engine.js
//
// Pure lead scoring: answers in, score and tier out. No DOM access, so the
// exact same code runs in the browser (via scoring.controller.js) and in the
// offline evaluator (scoring/evaluate.mjs) that produces the test results.
//
// Config keys, all optional unless noted:
//
//   questions[]            required
//     id, field            field is the submitted field name
//     maxPoints            cap on the question's points
//     aggregate            "sum" (default) or "max" for multi-select answers
//     aliases              { rawValue: optionKey } folds legacy / variant values
//     options              { optionKey: points }
//     defaultPoints        points for an answered value not listed in options
//   scale                  "raw" (default) or "percent_of_asked"
//   tiers[]                { name, minScore }, highest minScore wins
//   forceTierRules[]       { id, type: "email_domain", tier, domains[] }

export function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function buildOptionLookup(question) {
  const lookup = new Map();

  Object.entries(question.options || {}).forEach(([key, points]) => {
    lookup.set(normalizeValue(key), Number(points || 0));
  });

  return lookup;
}

function buildAliasLookup(question) {
  const lookup = new Map();

  Object.entries(question.aliases || {}).forEach(([raw, key]) => {
    lookup.set(normalizeValue(raw), normalizeValue(key));
  });

  return lookup;
}

// Lookups are cached per question object; configs are treated as immutable.
const lookupCache = new WeakMap();

function getLookups(question) {
  if (!lookupCache.has(question)) {
    lookupCache.set(question, {
      options: buildOptionLookup(question),
      aliases: buildAliasLookup(question),
    });
  }

  return lookupCache.get(question);
}

export function getOptionPoints(question, value) {
  const { options, aliases } = getLookups(question);

  const normalized = normalizeValue(value);
  const key = aliases.get(normalized) ?? normalized;

  if (options.has(key)) return options.get(key);

  return Number(question.defaultPoints || 0);
}

export function evaluateQuestion(question, values, isAsked) {
  const cleanValues = (values || [])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  const optionPoints = cleanValues.map((value) => getOptionPoints(question, value));

  const rawPoints =
    question.aggregate === "max"
      ? Math.max(0, ...optionPoints)
      : optionPoints.reduce((total, points) => total + points, 0);

  const maxPoints =
    question.maxPoints === undefined || question.maxPoints === null
      ? rawPoints
      : Number(question.maxPoints);

  return {
    id: question.id,
    field: question.field,
    source: question.source,
    values: cleanValues,
    asked: Boolean(isAsked) || cleanValues.length > 0,
    rawPoints,
    maxPoints,
    points: Math.min(rawPoints, maxPoints),
  };
}

export function getEmailDomain(email) {
  if (!email || !String(email).includes("@")) return "";

  return String(email).split("@").pop().trim().toLowerCase();
}

function domainMatches(emailDomain, blockedDomain) {
  const cleanEmailDomain = normalizeValue(emailDomain);
  const cleanBlockedDomain = normalizeValue(blockedDomain);

  return (
    cleanEmailDomain === cleanBlockedDomain ||
    cleanEmailDomain.endsWith(`.${cleanBlockedDomain}`)
  );
}

export function getForcedTier(scoringConfig, { emailDomain }) {
  for (const rule of scoringConfig.forceTierRules || []) {
    if (rule.type !== "email_domain") continue;

    const isMatch = (rule.domains || []).some((domain) => {
      return domainMatches(emailDomain, domain);
    });

    if (isMatch) {
      return {
        tier: rule.tier,
        ruleId: rule.id,
      };
    }
  }

  return null;
}

export function getTier(scoringConfig, score) {
  const tiers = [...(scoringConfig.tiers || [])].sort((a, b) => {
    return Number(b.minScore) - Number(a.minScore);
  });

  const matchedTier = tiers.find((tier) => score >= Number(tier.minScore));

  return matchedTier?.name || "";
}

function computeScore(scoringConfig, questions) {
  const earned = questions.reduce((total, question) => total + question.points, 0);

  if (scoringConfig.scale !== "percent_of_asked") return earned;

  const possible = questions
    .filter((question) => question.asked)
    .reduce((total, question) => total + question.maxPoints, 0);

  if (!possible) return 0;

  return Math.round((100 * earned) / possible);
}

// answers:     { fieldName: [values] }
// askedFields: optional Set / array of field names shown to the lead, so a
//              shown-but-unanswered question still counts in the denominator.
// emailDomain: lowercased domain, used only by forceTierRules.
export function scoreLead(scoringConfig, { answers = {}, askedFields = [], emailDomain = "" } = {}) {
  const asked = new Set(askedFields);

  const questions = (scoringConfig.questions || []).map((question) => {
    return evaluateQuestion(question, answers[question.field], asked.has(question.field));
  });

  const score = computeScore(scoringConfig, questions);
  const forcedTier = getForcedTier(scoringConfig, { emailDomain });

  return {
    score,
    tier: forcedTier ? forcedTier.tier : getTier(scoringConfig, score),
    questions,
    forcedTier,
  };
}
