// src/features/visibility.controller.js

export function createVisibilityController({
    state,
    config,
}) {
    const visibilityConfig = config.visibility || {};

    function isEnabled() {
        return visibilityConfig.enabled === true;
    }

    function normalize(value) {
        return String(value || "").trim();
    }

    function parseFlags(value) {
        return String(value || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function normalizeList(value) {
        if (!value) return [];

        if (Array.isArray(value)) {
            return value.map(String).map((item) => item.trim()).filter(Boolean);
        }

        return String(value)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    // Set by the Webflow page, never by this bundle:
    //   window.AthenaForm.webflowGlobals.call = true
    // Read lazily so Webflow can set it before or after init, and so it can be
    // toggled at runtime without a redeploy.
    function isWebflowGlobalEnabled(key) {
        if (!key) return false;

        const value = window.AthenaForm?.webflowGlobals?.[key];

        // Accept "true" too — Webflow embeds often stringify values.
        return value === true || value === "true";
    }

    function getGlobalFlags() {
        const globalName = visibilityConfig.globalName || "__ATHENA_FLAGS__";
        const rawFlags = window[globalName];

        if (Array.isArray(rawFlags)) {
            return rawFlags.map(normalize).filter(Boolean);
        }

        if (typeof rawFlags === "string") {
            return parseFlags(rawFlags);
        }

        return [];
    }

    function getVisibilityFlags() {
        const flags = state.visibilityFlags || [];

        if (Array.isArray(flags)) {
            return flags.map(normalize).filter(Boolean);
        }

        if (typeof flags === "string") {
            return parseFlags(flags);
        }

        return [];
    }

    function hasFlag(flag) {
        return getVisibilityFlags().includes(String(flag));
    }

    function matchesAnyFlag(requiredFlags) {
        return requiredFlags.some((flag) => hasFlag(flag));
    }

    function enable(flag, options = {}) {
        const normalizedFlag = normalize(flag);

        if (!normalizedFlag) return;

        const flags = getVisibilityFlags();

        if (!flags.includes(normalizedFlag)) {
            flags.push(normalizedFlag);
        }

        state.visibilityFlags = flags;

        if (options.apply !== false) {
            apply();
        }
    }

    function disable(flag, options = {}) {
        const normalizedFlag = normalize(flag);

        if (!normalizedFlag) return;

        state.visibilityFlags = getVisibilityFlags().filter(
            (item) => item !== normalizedFlag
        );

        if (options.apply !== false) {
            apply();
        }
    }

    function syncFromGlobal() {
        const globalFlags = getGlobalFlags();

        globalFlags.forEach((flag) => {
            enable(flag, {
                apply: false,
            });
        });
    }

    function getSelectedValueForRule(stepName, rule) {
        if (!rule?.field) return null;

        const $step = $(`[step="${stepName}"]`);

        const $checked = $step.find(`[name="${rule.field}"]:checked`);

        if ($checked.length) {
            return $checked.val();
        }

        const $field = $step.find(`[name="${rule.field}"]`).first();

        if ($field.length) {
            return $field.val();
        }

        return null;
    }

    function ruleMatchesValue(rule, selectedValue) {
        if (selectedValue === null || selectedValue === undefined) return false;

        const selectedValues = normalizeList(selectedValue);

        const acceptedValues = rule.values
            ? normalizeList(rule.values)
            : normalizeList(rule.value);

        if (!selectedValues.length || !acceptedValues.length) return false;

        return selectedValues.some((value) => acceptedValues.includes(value));
    }

    function applyAnswerRules(stepName) {
        const rules = visibilityConfig.answerRules || [];

        if (!rules.length) return;

        rules.forEach((rule) => {
            if (String(rule.step) !== String(stepName)) return;
            if (!rule.flag) return;

            // Runtime kill switch set by Webflow. Read live on every pass so it
            // can be flipped without a redeploy.
            if (
                rule.requiresWebflowGlobal &&
                !isWebflowGlobalEnabled(rule.requiresWebflowGlobal)
            ) {
                disable(rule.flag, {
                    apply: false,
                });

                return;
            }

            const selectedValue = getSelectedValueForRule(stepName, rule);
            const isMatch = ruleMatchesValue(rule, selectedValue);

            if (isMatch) {
                enable(rule.flag, {
                    apply: false,
                });
            } else {
                disable(rule.flag, {
                    apply: false,
                });
            }
        });

        apply();
    }

    function applyElements() {
        const selector =
            visibilityConfig.selectors?.elements ||
            "[data-athena-show]";

        const attr =
            visibilityConfig.attributes?.elements ||
            "data-athena-show";

        $(selector).each(function () {
            const $el = $(this);
            const requiredFlags = parseFlags($el.attr(attr));

            if (matchesAnyFlag(requiredFlags)) {
                $el.attr("data-athena-active", "true");
                $el.removeAttr("hidden");
                $el.show();
            } else {
                $el.removeAttr("data-athena-active");
                $el.attr("hidden", "");
                $el.hide();
            }
        });
    }

    function applyReferrerRules() {
        const rules = visibilityConfig.referrerRules || [];
        const referrer = document.referrer || "";

        if (!referrer) return;

        rules.forEach((rule) => {
            if (!rule.referrerIncludes || !rule.flag) return;

            if (referrer.includes(rule.referrerIncludes)) {
                enable(rule.flag, {
                    apply: false,
                });
            }
        });
    }

    function applySteps() {
        const selector =
            visibilityConfig.selectors?.steps ||
            "[data-athena-step-flag]";

        const attr =
            visibilityConfig.attributes?.steps ||
            "data-athena-step-flag";

        $(selector).each(function () {
            const $step = $(this);
            const requiredFlags = parseFlags($step.attr(attr));

            if (matchesAnyFlag(requiredFlags)) {
                $step.attr("data-athena-active", "true");
                $step.removeAttr("skip");
            } else {
                $step.removeAttr("data-athena-active");
                $step.attr("skip", "");
            }
        });
    }

    function apply() {
        if (!isEnabled()) return;

        syncFromGlobal();
        applyElements();
        applySteps();

        window.AthenaForm?.steps?.updateProgressBar?.();
    }

    function reset() {
        state.visibilityFlags = [];
        apply();
    }

    function init() {
        if (!isEnabled()) return;

        syncFromGlobal();
        applyReferrerRules();
        apply();
    }

    return {
        init,
        apply,
        enable,
        disable,
        reset,
        hasFlag,
        syncFromGlobal,
        applyAnswerRules,
    };
}