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
  function hasHoneypotValue() {
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
    const $submitBtn = $("[cmd='proceed'][last]");

    $submitBtn.data("is-submitting", false);
    $submitBtn.prop("disabled", false);
    $submitBtn.removeClass("disabled");
  }

  function showTier3Message() {
    $('[c_element="error_title"]').text("We'll be in touch!");
    $('[c_element="error_body"]').text("Someone from our team will call you shortly.");
  }

  // Routing is configured separately from scoring so the score can keep being
  // recorded while tier-based routing is switched off ([] = everyone books).
  function skipsCalendar(scoringResult) {
    const tiers = config.scoring?.routing?.skipCalendarTiers ?? ["tier_3"];

    return Boolean(scoringResult?.tier) && tiers.includes(scoringResult.tier);
  }

  async function submit() {
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

      const payload = hubspot.buildSubmissionPayload();
      await hubspot.submitForm(payload);

      // HubSpot already received the submission. For tiers routed away from
      // self-booking, stop the ChiliPiper flow and show the custom message.
      if (skipsCalendar(scoringResult)) {
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