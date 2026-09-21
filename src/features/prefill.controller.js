// src/features/prefill.controller.js

import { getCookie, parseEncodedCookiePairs } from "../utils/cookies.js";
import { getUrlParams } from "../utils/url.js";

export function createPrefillController({
  state,
  config,
  validation,
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

  // A campaign param in the URL means this visit is a fresh touch. utm_content
  // is included through "code", which applyUrlParams maps onto it. twclid is
  // deliberately not a trigger: it only feeds x_click_id, never a utm_* field,
  // so on its own it would blank the stored campaign rather than replace it.
  function hasUrlAttribution() {
    const urlParams = getUrlParams();

    return Object.keys(urlParams).some(
      (key) => key.startsWith("utm_") || key === "code"
    );
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

    if (parts.length <= 2) return "";

    const segment = parts[2];

    // GA4 ships two cookie layouts. The old GS1 form is dot-delimited and puts
    // the session id alone in this segment. The current GS2 form packs the rest
    // of the cookie into this one segment as "s<sessionId>$o1$g1$t...", so
    // returning it raw hands HubSpot the whole blob instead of an id.
    const gs2SessionId = segment.match(/^s(\d+)/);

    if (gs2SessionId) return gs2SessionId[1];

    return segment;
  }

  function applyGa4Fields() {
    if (config.ga4?.enabled === false) return;

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

  function utmCaptureEnabled() {
    return config.utm?.enabled !== false;
  }

  function updateUTMS() {
    // With capture off the UTM hidden inputs are whatever Webflow hardwired:
    // nothing here reads the URL or the _athn_utms cookie, and nothing writes
    // over those fields. GA4 is a separate switch and self-guards.
    if (!utmCaptureEnabled()) {
      applyGa4Fields();
      return state.utmParams;
    }

    setDefaultUtms();
    applyUrlParams();

    // Last touch. With campaign params in the URL the stored cookie must not
    // fill in around them, or a partial link (utm_campaign only) would inherit
    // the previous visit's source/medium/term/content and report as a blend of
    // two touches. Whatever the URL leaves unset stays on the fallback value.
    // With no campaign params there is no new touch, so the cookie still
    // supplies the previous one.
    if (!hasUrlAttribution()) {
      applyUtmCookie();
    }

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
    if (config.prefill?.enabled === false) return {};

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

  // Webflow markup does not carry solo="" on every field (the email input is
  // one that misses it), and solo is what tells validation "untouched, do not
  // style this yet". Stamp it on the still-empty fields of a step we just
  // wrote to, so the first validation run cannot flag a field the user has
  // never touched. Every interaction handler still strips it on click/change.
  function markUntouchedFields($step, autofilledNames) {
    $step
      .find("input, select")
      .not("[honey]")
      .not("[ignore]")
      .not("[type=hidden]")
      .each(function () {
        const $field = $(this);

        if (autofilledNames.includes($field.attr("name"))) return;
        if ($field.attr("solo") !== undefined) return;
        if (String($field.val() || "").trim() !== "") return;

        $field.attr("solo", "");
      });
  }

  // Runs after hubspot.renderCustomFields(), so the custom selects exist by the
  // time this writes to them. Values are written directly rather than through a
  // change event: a change on page load runs the whole step's validation, which
  // flags every still-empty field and disables the continue button before the
  // user has typed anything.
  function applyAutofillFields() {
    const autofillFields = config.autofillFields || [];
    const autofilledNames = [];
    const touchedSteps = [];

    autofillFields.forEach(({ name, value }) => {
      const $target = $(`[name="${name}"]`).not("[honey]");

      if (!$target.length) {
        console.warn(`Autofill field not found: ${name}`);
        return;
      }

      $target.removeAttr("solo");
      $target.val(value);

      // A select silently ends up null when no option matches, which would
      // otherwise look like the autofill worked.
      if ($target.is("select") && $target.val() !== value) {
        console.warn(`Autofill option not found for ${name}: ${value}`);
      }

      autofilledNames.push(name);

      const step = $target.closest("[step]").attr("step");

      if (step && !touchedSteps.includes(step)) {
        touchedSteps.push(step);
      }

      // hdyhau_primary owns the secondary field's placeholder and visibility.
      // Normally a change event reaches this through step validation; call it
      // directly instead, so nothing else on the step gets validated yet.
      if (name === "hdyhau_primary") {
        validation?.updateHdyhauSecondary?.($target.val(), step);
      }
    });

    touchedSteps.forEach((step) => {
      markUntouchedFields($(`[step="${step}"]`), autofilledNames);
    });
  }

  function init() {
    updateUTMS();
    applyPrefillSteps();
    applyAutofillFields();
  }

  return {
    init,
    updateUTMS,
    applyPrefillSteps,
    applyAutofillFields,
    getPrefillPairs,
    applyParamsToFields,
    applyGa4Fields,
  };
}