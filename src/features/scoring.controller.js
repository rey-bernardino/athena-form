// src/features/scoring.controller.js

export function createScoringController({
  state,
  config,
}) {
  const scoringConfig = config.scoring || {};

  function isEnabled() {
    return scoringConfig.enabled === true;
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getFieldValues(fieldName) {
    const $fields = $(`[name="${fieldName}"]`);

    if (!$fields.length) return [];

    const firstType = $fields.first().attr("type");
    // Radio: only score checked value
    if (firstType === "radio") {
      const $checked = $fields.filter(":checked");

      if (!$checked.length) return [];

      return [$checked.val()];
    }

    // Checkbox: only score checked values
    if (firstType === "checkbox") {
      const values = [];

      $fields.filter(":checked").each(function () {
        values.push($(this).val());
      });

      return values;
    }

    // Hidden checkbox aggregator / text / select
    const value = $fields.first().val();

    if (!value) return [];

    return String(value)
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function getUtmValues(fieldName) {
    const value =
      state.utmParams?.[fieldName] ||
      $(`[name="${fieldName}"]`).first().val();

    if (!value) return [];

    return [value];
  }

  function getQuestionValues(question) {
    if (question.source === "field") {
      return getFieldValues(question.field);
    }

    if (question.source === "utm") {
      return getUtmValues(question.field);
    }

    return [];
  }

  function getOptionPoints(question, value) {
    const options = question.options || {};
    const normalizedValue = normalize(value);

    const matchedKey = Object.keys(options).find((key) => {
      return normalize(key) === normalizedValue;
    });

    if (!matchedKey) return 0;

    return Number(options[matchedKey] || 0);
  }

  function getEmailDomain(email) {
    if (!email || !String(email).includes("@")) return "";

    return String(email)
      .split("@")
      .pop()
      .trim()
      .toLowerCase();
  }

  function domainMatches(emailDomain, blockedDomain) {
    const cleanEmailDomain = String(emailDomain || "").toLowerCase();
    const cleanBlockedDomain = String(blockedDomain || "").toLowerCase();

    return (
      cleanEmailDomain === cleanBlockedDomain ||
      cleanEmailDomain.endsWith(`.${cleanBlockedDomain}`)
    );
  }

  function getForcedTier() {
    const rules = scoringConfig.forceTierRules || [];

    for (const rule of rules) {
      if (rule.type !== "email_domain") continue;

      const email = $(`[name="${rule.field}"]`).val();
      const emailDomain = getEmailDomain(email);

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

  function evaluateQuestion(question) {
    const values = getQuestionValues(question);

    const rawPoints = values.reduce((total, value) => {
      return total + getOptionPoints(question, value);
    }, 0);

    const maxPoints =
      question.maxPoints === undefined || question.maxPoints === null
        ? rawPoints
        : Number(question.maxPoints);

    const points = Math.min(rawPoints, maxPoints);

    return {
      id: question.id,
      field: question.field,
      source: question.source,
      values,
      rawPoints,
      maxPoints,
      points,
    };
  }

  function getTier(score) {
    const tiers = [...(scoringConfig.tiers || [])].sort((a, b) => {
      return Number(b.minScore) - Number(a.minScore);
    });

    const matchedTier = tiers.find((tier) => {
      return score >= Number(tier.minScore);
    });

    return matchedTier?.name || "";
  }

  function ensureHiddenField(name) {
    if (!name) return null;

    let $field = $(`[name="${name}"]`).first();

    if ($field.length) {
      return $field;
    }

    const $form = $("#athn_form");

    if (!$form.length) {
      console.warn(`Cannot create hidden scoring field: ${name}. #athn_form not found.`);
      return null;
    }

    $field = $("<input>", {
      type: "hidden",
      name,
    });

    $form.append($field);

    return $field;
  }

  function writeHiddenFields(result) {
    const fields = scoringConfig.outputFields || {};

    const $scoreField = ensureHiddenField(fields.score);
    const $tierField = ensureHiddenField(fields.tier);

    if ($scoreField) {
      $scoreField.val(String(result.score));
    }

    if ($tierField) {
      $tierField.val(result.tier);
    }
  }

  function calculate() {
    if (!isEnabled()) {
      return {
        score: 0,
        tier: "",
        questions: [],
      };
    }

    const questions = (scoringConfig.questions || []).map(evaluateQuestion);

    const score = questions.reduce((total, question) => {
      return total + question.points;
    }, 0);

    const forcedTier = getForcedTier();

    const tier = forcedTier
      ? forcedTier.tier
      : getTier(score);

    return {
      score,
      tier,
      questions,
      forcedTier,
    };
  }

  function calculateAndWrite() {
    const result = calculate();

    // Disabled scoring leaves the hidden fields alone rather than stamping
    // them with score 0 / empty tier (ensureHiddenField would create them).
    if (isEnabled()) {
      writeHiddenFields(result);
    }

    //console.log("Lead scoring result:", result);

    return result;
  }

  return {
    calculate,
    calculateAndWrite,
    writeHiddenFields,
  };
}