// src/features/prefill.controller.js

import { getCookie, parseEncodedCookiePairs } from "../utils/cookies.js";
import { getUrlParams } from "../utils/url.js";

export function createPrefillController({
  state,
  config,
}) {
  function setDefaultUtms() {
    state.utmParams.utm_campaign = config.fallbackValue;
    state.utmParams.utm_source = config.fallbackValue;
    state.utmParams.utm_medium = config.fallbackValue;
    state.utmParams.utm_term = config.fallbackValue;
    state.utmParams.utm_content = config.fallbackValue;
  }

  function applyUrlParams() {
    const urlParams = getUrlParams();

    Object.entries(urlParams).forEach(([key, value]) => {
      if (key === "code") {
        state.utmParams.utm_content = value;
        return;
      }

      if (key === "twclid") {
        state.utmParams.x_click_id = value;
        return;
      }

      state.utmParams[key] = value;
    });
  }

  function applyUtmCookie() {
    const rawCookieValue = getCookie("_athn_utms");

    if (!rawCookieValue) return;

    const cookieParams = parseEncodedCookiePairs(rawCookieValue);

    Object.assign(state.utmParams, cookieParams);
  }

  function applyParamsToFields() {
    Object.entries(state.utmParams).forEach(([key, value]) => {
      const $target = $(`[name="${key}"]`);

      if ($target.length) {
        $target.val(value);
      }
    });
  }

  function getGa4ClientId() {
    const gaCookie = getCookie("_ga");

    if (!gaCookie) return "";

    return gaCookie.substring(6);
  }

  function getGa4SessionId() {
    const sessionCookieName = "_ga_F88E4P7L9R";
    const gaSessionCookie = getCookie(sessionCookieName);

    if (!gaSessionCookie) return "";

    const parts = gaSessionCookie.split(".");

    if (parts.length > 2) {
      return parts[2];
    }

    return "";
  }

  function applyGa4Fields() {
    const clientId = getGa4ClientId();
    const sessionId = getGa4SessionId();

    const clientInput = document.querySelector(
      'input[name="ga4_clientid"]'
    );

    const sessionInput = document.querySelector(
      'input[name="ga4_sessionid"]'
    );

    if (clientInput) {
      clientInput.value = clientId;
    }

    if (sessionInput) {
      sessionInput.value = sessionId;
    }
  }

  function getTodayDate() {
    const now = new Date();

    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${month}/${day}/${now.getFullYear()}`;
  }

  // MM/DD/YYYY in the visitor's own local time, stamped once on page load.
  function applyConsentDateFields() {
    const consentConfig = config.consentDateFields || {};

    if (consentConfig.enabled === false) return;

    const names = consentConfig.names || [];
    if (!names.length) return;

    const today = getTodayDate();

    names.forEach((fieldName) => {
      let $field = $(`[name="${fieldName}"]`);

      if (!$field.length) {
        $field = $("<input>", { type: "hidden", name: fieldName });
        $("#athn_form").append($field);
      }

      $field.val(today);
      $field.attr("value", today);
    });
  }

  function updateUTMS() {
    setDefaultUtms();
    applyUrlParams();
    applyUtmCookie();
    applyParamsToFields();
    applyGa4Fields();

    return state.utmParams;
  }

  function getPrefillPairs() {
    const pairs = {};

    Object.entries(state.utmParams).forEach(([key, value]) => {
      if (!key.startsWith("pq")) return;

      const index = key.replace("pq", "");
      const valueKey = `pv${index}`;

      if (!state.utmParams[valueKey]) return;

      const decodedKey = decodeURIComponent(value);
      const decodedValue = decodeURIComponent(state.utmParams[valueKey]);

      pairs[decodedKey] = decodedValue;
    });

    return pairs;
  }

  function prefillRadioStep($targetStep, value) {
    const $inputs = $targetStep.find('input[type="radio"]');

    $inputs.each(function () {
      if ($(this).val() === value) {
        $(this).prop("checked", true);
      }
    });
  }

  function prefillCheckboxStep($targetStep, value) {
    const answers = value.split(";");

    const $hiddenInput = $targetStep.find('input[type="hidden"]').first();

    if ($hiddenInput.length) {
      $hiddenInput.val(value);
    }

    $targetStep.find('input[type="checkbox"]').each(function () {
      if (answers.includes($(this).val())) {
        $(this).prop("checked", true);
      }
    });
  }

  function applyPrefillSteps() {
    const prefillPairs = getPrefillPairs();

    Object.entries(prefillPairs).forEach(([fieldName, value]) => {
      const $targetStep = $(`[step][hsfield="${fieldName}"]`);

      if (!$targetStep.length) return;

      // Matches your current behavior: hide/skip prefilled steps
      $targetStep.attr("skip", "").attr("prefilled", "");

      const $inputs = $targetStep.find("input");
      const mode = $inputs.first().attr("type");

      if (mode === "radio") {
        prefillRadioStep($targetStep, value);
        return;
      }

      if (mode === "hidden") {
        prefillCheckboxStep($targetStep, value);
        return;
      }

      console.warn(`Unsupported prefill field type for ${fieldName}`);
    });

    return prefillPairs;
  }

  function init() {
    updateUTMS();
    applyPrefillSteps();
    applyConsentDateFields();
  }

  return {
    init,
    updateUTMS,
    applyPrefillSteps,
    getPrefillPairs,
    applyParamsToFields,
    applyGa4Fields,
    applyConsentDateFields,
  };
}