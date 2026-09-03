// src/integrations/attribution.service.js

export function createAttributionService({
  state,
  config,
}) {
  function checkGA4() {
    if (window.dataLayer) {
      return true;
    }

    console.log("gtag missing");
    return false;
  }

  function getConversionId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function retrieve(step) {
    const $elements = $(`[step="${step}"] [name]`).not("[ignore]");

    const answers = [];
    const fields = [];

    $elements.each(function () {
      const $el = $(this);
      const name = $el.attr("name");
      const type = $el.attr("type");

      if (name && !fields.includes(name)) {
        fields.push(name);
      }

      if (type === "radio") {
        if ($el.is(":checked")) {
          answers.push($el.val());
        }

        return;
      }

      if (type === "hidden") {
        const value = $el.val();

        if (value) {
          answers.push(value);
        }

        return;
      }

      if ($el.is("select")) {
        const value = $el.val();

        if (value) {
          answers.push(value);
        }

        return;
      }

      if (type === "checkbox") {
        if ($el.is(":checked")) {
          answers.push($el.val());
        }

        return;
      }

      const value = $el.val();

      if (value) {
        answers.push(value);
      }
    });

    return {
      answers,
      fields,
    };
  }

  function fire(stepId = "", answers = [], fields = []) {
    if (config.attribution?.enabled === false) return;

    if (!checkGA4()) return;

    const formattedFields = fields.join(";");
    const formattedAnswers = answers.join(";");

    const event = "athena_attribution";
    const conversionId = getConversionId();

    let eventName = `abtest_stepcomplete_step${stepId}`;

    if (stepId === "calendar") {
      const email = $('[name="email"]').val();
      const phone = $('[name="phone"]').val();

      eventName = `abtest_stepcomplete_${stepId}`;

      window.dataLayer.push({
        event,
        event_name: eventName,
        "form-phonenumber-field": phone,
        "form-email": email,
        conversion_id: conversionId,
      });

      return;
    }

    const excludedSteps =
      config.excludedAttributionSteps ||
      window.excludedSteps ||
      [];

    if (excludedSteps.includes(stepId)) {
      eventName = `abtest_stepcomplete_${stepId}`;

      window.dataLayer.push({
        event,
        event_name: eventName,
        conversion_id: conversionId,
      });

      return;
    }

    window.dataLayer.push({
      event,
      event_name: eventName,
      fields: formattedFields,
      answers: formattedAnswers,
      conversion_id: conversionId,
    });
  }

  function bingEC() {
    if (window.uetq) {
      window.uetq.push("set", {
        pid: {
          em: "{{DLV - Email}}",
          ph: "{{DLV - Phone}}",
        },
      });

      return;
    }

    console.log("Bing firing Fail");
  }

  function vowelCheck() {
    const firstName = $('[name="firstname"]').val() || "";
    const lastName = $('[name="lastname"]').val() || "";

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const vowelCount = (fullName.match(/[aeiou]/gi) || []).length;

    const consonantOnlyPattern =
      /^[bcdfghjklmnpqrstvwxyz]{3,}\s[bcdfghjklmnpqrstvwxyz]{3,}$/i;

    if (vowelCount < 2 || consonantOnlyPattern.test(fullName)) {
      return false;
    }

    return true;
  }

  return {
    checkGA4,
    retrieve,
    fire,
    bingEC,
    vowelCheck,
  };
}