// src/features/scoring.controller.js
//
// DOM adapter for the lead scoring engine: reads answers off the form, hands
// them to scoring.engine.js, and writes the result into hidden fields.

import { getEmailDomain, scoreLead } from "./scoring.engine.js";

export function createScoringController({
  state,
  config,
}) {
  const scoringConfig = config.scoring || {};

  function isEnabled() {
    return scoringConfig.enabled === true;
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

  // A question counts as asked when its field sits in a step the lead could
  // see. Branching and prefill both mark hidden steps with [skip].
  function isFieldAsked(fieldName) {
    const $fields = $(`[name="${fieldName}"]`);

    if (!$fields.length) return false;

    const $step = $fields.first().closest("[step]");

    return !$step.length || !$step.is("[skip]");
  }

  function collectInputs() {
    const answers = {};
    const askedFields = [];

    (scoringConfig.questions || []).forEach((question) => {
      answers[question.field] = getQuestionValues(question);

      if (question.source === "utm" || isFieldAsked(question.field)) {
        askedFields.push(question.field);
      }
    });

    const emailFields = (scoringConfig.forceTierRules || [])
      .map((rule) => rule.field)
      .filter(Boolean);

    const email = emailFields.length
      ? $(`[name="${emailFields[0]}"]`).val()
      : "";

    return {
      answers,
      askedFields,
      emailDomain: getEmailDomain(email),
    };
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

    return scoreLead(scoringConfig, collectInputs());
  }

  function calculateAndWrite() {
    const result = calculate();

    // Disabled: leave leadscoring_* untouched so HubSpot doesn't receive a 0 score.
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