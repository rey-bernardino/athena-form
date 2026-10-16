import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { FORM_CONFIG } from "../../src/config/form.config.js";
import { SCORING_RUBRIC } from "../../src/config/scoring.config.js";
import { scoreLead } from "../../src/features/scoring.engine.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(HERE, "..", file), "utf8"));

const multi = {
  id: "tasks",
  field: "tasks",
  maxPoints: 6,
  aggregate: "max",
  options: { calendar: 6, email: 3 },
};

const single = {
  id: "timeline",
  field: "timeline",
  maxPoints: 4,
  defaultPoints: 2,
  aliases: { ASAP: "asap_this_is_a_priority" },
  options: { asap_this_is_a_priority: 4, exploring: 0 },
};

test("legacy rubric: options sum, then the question cap applies", () => {
  const config = { questions: [{ ...multi, aggregate: undefined }] };

  assert.equal(scoreLead(config, { answers: { tasks: ["calendar", "email"] } }).score, 6);
  assert.equal(scoreLead(config, { answers: { tasks: ["email"] } }).score, 3);
});

test("max aggregate scores the best selected option only", () => {
  const config = { questions: [{ ...multi, maxPoints: 20 }] };

  assert.equal(scoreLead(config, { answers: { tasks: ["calendar", "email"] } }).score, 6);
});

test("aliases and option keys match case-insensitively", () => {
  const config = { questions: [single] };

  assert.equal(scoreLead(config, { answers: { timeline: ["asap"] } }).score, 4);
  assert.equal(scoreLead(config, { answers: { timeline: ["Asap_This_Is_A_Priority"] } }).score, 4);
});

test("an answered value outside the options earns defaultPoints", () => {
  const config = { questions: [single] };

  assert.equal(scoreLead(config, { answers: { timeline: ["brand_new_option"] } }).score, 2);
});

test("percent_of_asked grades only the questions a lead was asked", () => {
  const config = { scale: "percent_of_asked", questions: [multi, single] };

  // Asked only the multi-select, and earned its full cap.
  assert.equal(scoreLead(config, { answers: { tasks: ["calendar"] } }).score, 100);

  // Both asked: 6 + 0 of 10.
  assert.equal(scoreLead(config, { answers: { tasks: ["calendar"], timeline: ["exploring"] } }).score, 60);
});

test("a shown but unanswered question counts as asked and earns 0", () => {
  const config = { scale: "percent_of_asked", questions: [multi, single] };
  const result = scoreLead(config, { answers: { tasks: ["calendar"] }, askedFields: ["timeline"] });

  assert.equal(result.score, 60);
});

test("a lead asked nothing scores 0", () => {
  const config = { scale: "percent_of_asked", questions: [multi], tiers: [{ name: "tier_3", minScore: 0 }] };

  assert.deepEqual(
    (({ score, tier }) => ({ score, tier }))(scoreLead(config, {})),
    { score: 0, tier: "tier_3" }
  );
});

test("tiers use the highest minScore the score reaches", () => {
  const config = {
    questions: [single],
    tiers: [
      { name: "tier_3", minScore: 0 },
      { name: "tier_1", minScore: 4 },
      { name: "tier_2", minScore: 2 },
    ],
  };

  assert.equal(scoreLead(config, { answers: { timeline: ["asap"] } }).tier, "tier_1");
  assert.equal(scoreLead(config, { answers: { timeline: ["other"] } }).tier, "tier_2");
  assert.equal(scoreLead(config, { answers: { timeline: ["exploring"] } }).tier, "tier_3");
});

test("blocked email domains force tier 3, including subdomains", () => {
  const config = {
    questions: [single],
    tiers: [{ name: "tier_1", minScore: 0 }],
    forceTierRules: [{ id: "blocked", type: "email_domain", tier: "tier_3", domains: ["getmagic.com"] }],
  };

  assert.equal(scoreLead(config, { answers: { timeline: ["asap"] }, emailDomain: "mail.getmagic.com" }).tier, "tier_3");
  assert.equal(scoreLead(config, { answers: { timeline: ["asap"] }, emailDomain: "notgetmagic.com" }).tier, "tier_1");
});

test("generated scoring.config.js matches the rubric it was built from", () => {
  const spec = readJson("spec.json");
  const rubric = readJson(`rubrics/${spec.name}.json`);

  assert.equal(SCORING_RUBRIC.version, rubric.name);
  assert.equal(SCORING_RUBRIC.scale, rubric.scale);
  assert.deepEqual(SCORING_RUBRIC.tiers, rubric.tiers);
  assert.deepEqual(SCORING_RUBRIC.forceTierRules, rubric.forceTierRules);
  assert.deepEqual(
    SCORING_RUBRIC.questions,
    rubric.questions.map(({ label, ...question }) => question)
  );
});

test("form.config.js serves the generated rubric and stays off until approved", () => {
  assert.equal(FORM_CONFIG.scoring.version, SCORING_RUBRIC.version);
  assert.equal(FORM_CONFIG.scoring.questions, SCORING_RUBRIC.questions);
  assert.equal(FORM_CONFIG.scoring.enabled, false);
});
