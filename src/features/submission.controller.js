// src/features/submission.controller.js

export function createSubmissionController({
  state,
  config,
  steps,
  animations,
  hubspot,
  attribution,
  scoring,
  errorLogger,
  formSchema
}) {
  function ensureHiddenField(fieldName) {
    let $field = $(`[name="${fieldName}"]`).first();

    if (!$field.length) {
      $field = $(`<input type="hidden" name="${fieldName}" id="${fieldName}">`);
      $("#athn_form").append($field);
    }

    return $field;
  }

  function writeField(fieldName, value) {
    const $field = ensureHiddenField(fieldName);

    $field.val(value);
    $field.attr("value", value);
  }

  function setCallRedirectField(postSubmitAction) {
    const value = postSubmitAction === "redirect" ? "calledchris" : "";

    writeField("growthtest_202608_chrislivelink", value);
  }

  // MM/DD/YYYY in the visitor's own local time, stamped at submit rather than
  // at load so it records when they actually sent the form.
  function setConsentDateField() {
    const consentConfig = config.consentDateField || {};

    if (consentConfig.enabled === false) return;
    if (!consentConfig.name) return;

    const now = new Date();

    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    writeField(consentConfig.name, `${month}/${day}/${now.getFullYear()}`);
  }

  function hasHoneypotValue() {
    if (config.honeypot?.enabled === false) return false;

    const value = $("[honey]").val();
    return String(value || "").trim() !== "";
  }

  function removeHoneypotMarkup() {
    $(".honeycontainer").remove();
  }

  function getSelectedCountryCode() {
    const phoneInstance = state.phoneInstance || window.iti;

    if (!phoneInstance?.getSelectedCountryData) {
      return "";
    }

    return phoneInstance.getSelectedCountryData().iso2;
  }

  function showErrorStep(errorData = {}) {
    errorLogger?.logError?.(errorData);
    attribution?.fire?.("error");
    steps.switchToStep("error");
  }

  function isBannedCountry() {
    if (config.bannedCountryRedirect?.enabled === false) return false;

    const countryCode = getSelectedCountryCode();

    return config.bannedCountries.includes(countryCode);
  }

  function normalizeSubmissionError(error) {
    const type = error?.type || "unknown_submission_exception";

    const extra = {
      status: error?.status || "",
      statusText: error?.statusText || "",
      hubspot_response: error?.data ? JSON.stringify(error.data) : "",
    };

    if (error?.originalError) {
      extra.original_error_message = error.originalError.message || "";
    }

    return {
      type,
      message: error?.message || "Unknown submission error",
      stack: error?.stack || "",
      extra,
    };
  }

  function unlockSubmitButton() {
    const $submitBtn = $(
      "[cmd='proceed'][last], [cmd='submit_redirect'], [cmd='submit_chili']"
    );

    $submitBtn.data("is-submitting", false);
    $submitBtn.prop("disabled", false);
    $submitBtn.removeClass("disabled");
  }

  function showTier3Message() {
    $('[c_element="error_title"]').text("We'll be in touch!");
    $('[c_element="error_body"]').text("Someone from our team will call you shortly.");
  }

  function isTier3(scoringResult) {
    return scoringResult?.tier === "tier_3";
  }

  async function submit(options = {}) {

    const postSubmitAction = options.postSubmitAction || "chili";

    if (state.isSubmitting) return;

    state.isSubmitting = true;

    state.successNoBook = false;
    state.chiliData = null;

    try {
      if (hasHoneypotValue()) {
        showErrorStep({
          type: "honeypot_triggered",
          message: "Honeypot field extra_contact had a value",
          extra: {
            extra_contact: $("[name='extra_contact']").val() || "",
          },
        });

        state.isSubmitting = false;
        return;
      }
      removeHoneypotMarkup();

      if (!attribution.vowelCheck()) {
        showErrorStep({
          type: "name_quality_failed",
          message: "Name quality / vowel check failed",
        });

        state.isSubmitting = false;
        return;
      }

      if (isBannedCountry()) {
        window.location.href = config.redirectUrls.bannedCountry;
        return;
      }

      const currentStep = steps.getCurrentStep();

      animations.toggleContinueButton("hide", currentStep);
      animations.toggleBackButton("hide");

      steps.switchToStep("loading_chili");

      let scoringResult = null;

      try {
        if (scoring?.calculateAndWrite) {
          scoringResult = scoring.calculateAndWrite();
        }
      } catch (error) {
        state.isSubmitting = false;

        showErrorStep({
          type: "scoring_calculation_failed",
          message: error?.message || "Lead scoring failed",
          stack: error?.stack || "",
        });

        return;
      }

      if (formSchema?.writeSnapshot) {
        formSchema.writeSnapshot();
      }

      setCallRedirectField(postSubmitAction);
      setConsentDateField();

      const payload = hubspot.buildSubmissionPayload();
      await hubspot.submitForm(payload);

      if (postSubmitAction === "redirect") {
        const redirectUrl = config.callStep?.redirectUrl;

        if (redirectUrl) {
          window.location.href = redirectUrl;
          return;
        }

        console.warn("Call step redirect selected, but no redirectUrl is configured.");

        state.isSubmitting = false;
        unlockSubmitButton();

        // Send the user back from loading_chili to the step they submitted from
        steps.switchToStep(currentStep);

        return;
      }

      if (isTier3(scoringResult)) {
        showTier3Message();

        state.isSubmitting = false;

        animations.toggleBackButton("hide");
        steps.switchToStep("error");

        return;
      }

      attribution.fire("calendar");

      steps.switchToStep("calendar");

      if (window.AthenaForm?.chili?.submit) {
        window.AthenaForm.chili.submit();
      } else if (window.main?.chili?.submit) {
        window.main.chili.submit();
      } else {
        console.warn("ChiliPiper submit handler not found");
      }

    } catch (error) {
      console.error("Submission error:", error);

      state.isSubmitting = false;
      unlockSubmitButton();

      showErrorStep(normalizeSubmissionError(error));
    }
  }

  return {
    submit,
  };
}