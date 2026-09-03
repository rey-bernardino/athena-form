// src/core/events.js

export function bindEvents({
    state,
    config,
    steps,
    validation,
    animations,
    branching,
    visibility,
    attribution,
    scoring,
}) {
    function submitFromCallStep(button, postSubmitAction) {
        const $button = $(button);

        if ($button.data("is-submitting")) return;

        $button.data("is-submitting", true);
        $button.prop("disabled", true);

        if (window.AthenaForm?.submission?.submit) {
            window.AthenaForm.submission.submit({
                postSubmitAction
            });
        } else if (window.main?.form?.s) {
            window.main.form.s({
                postSubmitAction
            });
        }
    }

    // Set by the Webflow page, never by this bundle:
    //   window.AthenaForm.webflowGlobals.call = true
    // Read lazily on every click so it can be toggled without a redeploy.
    function isCallFlowEnabled() {
        const callStepConfig = config.callStep || {};

        // Config wins over the Webflow global, not the other way round.
        if (callStepConfig.enabled === false) return false;

        if (callStepConfig.requireWebflowGlobal === false) return true;

        const value =
            window.AthenaForm?.webflowGlobals?.[
                callStepConfig.webflowGlobalKey || "call"
            ];

        // Accept "true" too — Webflow embeds often stringify values.
        return value === true || value === "true";
    }

    function routeToCallStepIfNeeded(currentStep) {
        if (currentStep !== "info") return false;

        // Master switch: without it every lead stays on the ChiliPiper flow.
        if (!isCallFlowEnabled()) return false;

        if (!visibility?.hasFlag?.("call-flow")) return false;

        let scoringResult = null;

        try {
            if (window.AthenaForm?.scoring?.calculateAndWrite) {
                scoringResult = window.AthenaForm.scoring.calculateAndWrite();
            } else if (scoring?.calculateAndWrite) {
                scoringResult = scoring.calculateAndWrite();
            }
        } catch (error) {
            console.error("Call step scoring failed:", error);
            return false;
        }

        const isTier3 = scoringResult?.tier === "tier_3";

        if (isTier3) {
            visibility.disable?.("show-call-step", { apply: false });
            visibility.enable?.("show-call-t3-step", { apply: false });
            visibility.apply?.();

            steps.switchToStep("call-t3");
            scrollToFormTop();

            return true;
        }

        visibility.disable?.("show-call-t3-step", { apply: false });
        visibility.enable?.("show-call-step", { apply: false });
        visibility.apply?.();

        steps.switchToStep("call");
        scrollToFormTop();

        return true;
    }

    function getFieldValues(fieldName) {
        const $checkedBoxes = $(`input[type="checkbox"][for="${fieldName}"]:checked`);

        if ($checkedBoxes.length) {
            return $checkedBoxes
                .map(function () {
                    return String($(this).val() || "").trim();
                })
                .get()
                .filter(Boolean);
        }

        const rawValue = $(`[name="${fieldName}"]`).first().val();

        return String(rawValue || "")
            .split(";")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function syncConditionalFieldRule(rule) {
        if (!rule?.field || !rule?.value) return;

        const values = getFieldValues(rule.field);
        const shouldShow = values.includes(String(rule.value));

        const $target = $(rule.targetSelector || `[conditional="${rule.field}"]`);
        const $secondary = rule.secondaryField
            ? $(`[name="${rule.secondaryField}"]`)
            : $();

        if (shouldShow) {
            $target.attr("data-conditional-active", "true");
            $target.removeAttr("hidden");
            $target.show();
            return;
        }

        $target.removeAttr("data-conditional-active");
        $target.attr("hidden", "");
        $target.hide();

        if ($secondary.length) {
            $secondary.val("");
            $secondary.attr("value", "");
            $secondary.attr("solo", "");
            $secondary.removeClass("invalid is-invalid error");
        }
    }

    function syncConditionalFields(changedFieldName = null) {
        const rules = config.conditionalFields || [];

        rules.forEach((rule) => {
            if (changedFieldName && rule.field !== changedFieldName) return;

            syncConditionalFieldRule(rule);
        });
    }


    function getStepNameFromElement(element) {
        return $(element).closest("[step]").attr("step");
    }

    function getStepElement(stepName) {
        return $(`[step="${stepName}"]`);
    }

    function scrollToFormTop() {
        if (window.lenis?.scrollTo) {
            window.lenis.scrollTo(0, {
                duration: 0.8,
            });
            return;
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    }

    function maybeShowBackButton() {
        const stepIndexes = steps.getSteps();

        if (stepIndexes[1] >= 1) {
            animations.toggleBackButton("show");
        }
    }

    function fireStepAttribution() {
        const currentStep = steps.getCurrentStep();

        const attributionService =
            attribution || window.AthenaForm?.attribution || window.attribution;

        if (!attributionService?.retrieve || !attributionService?.fire) {
            console.warn("Attribution service not available");
            return;
        }

        const data = attributionService.retrieve(currentStep);

        //log hide
        // console.log("Firing attribution", {
        //     step: currentStep,
        //     answers: data.answers,
        //     fields: data.fields,
        // });

        attributionService.fire(
            currentStep,
            data.answers,
            data.fields
        );
    }

    function syncCheckboxGroup(checkbox) {
        const identifier = $(checkbox).attr("for");
        if (!identifier) return;

        const checkedBoxes = $(`[for="${identifier}"]:checked`);
        const values = [];

        checkedBoxes.each(function () {
            values.push($(this).val());
        });

        $(`[name="${identifier}"]`).val(values.join(";"));
    }

    function syncPhoneValue() {
        if (window.AthenaForm?.phone?.syncHiddenPhoneField) {
            window.AthenaForm.phone.syncHiddenPhoneField();
            return;
        }

        const phoneInstance = state.phoneInstance || window.iti;

        if (!phoneInstance || !window.intlTelInput?.utils) return;

        const value = phoneInstance.getNumber(
            window.intlTelInput.utils.numberFormat.E164
        );

        $('[name="phone"]').val(value);
    }

    function updateValidationForElement(element) {
        const stepName = getStepNameFromElement(element);
        if (!stepName) return false;

        return validation.updateStepValidationUI(stepName);
    }

    // The proceed mask is hidden by animating height/opacity to 0, not by being
    // removed from the layout — and on mobile it is fixed to the bottom of the
    // viewport. That leaves an invisible but tappable button, so the click
    // itself is never proof that the step is passable. Re-check on every click.
    function canProceedFromStep(stepName) {
        if (!stepName) return false;

        const $step = getStepElement(stepName);

        if (!$step.length) return true;

        const hasValidatableFields = $step
            .find("input[name], select[name], textarea[name]")
            .not("[ignore]")
            .not("[honey]")
            .length > 0;

        // Intro / interstitial steps have nothing to validate — leave them alone.
        if (!hasValidatableFields) return true;

        // validateStep paints the invalid field styling as it runs, which is the
        // feedback we want here. Deliberately NOT updateStepValidationUI: that
        // also collapses the proceed mask, and radio steps auto-advance from
        // their change handler without ever re-showing it — so a blocked tap
        // would permanently kill a continue button that was legitimately open.
        if (validation.validateStep(stepName)) return true;

        $step.removeAttr("validated");

        return false;
    }

    // prevent duplicate binding
    $(document).off(".athenaForm");

    $(document).on("change.athenaForm", "input[type='radio']", function () {
        state.nextLocked = true;
        state.backLocked = true;

        const stepName = getStepNameFromElement(this);
        const $step = getStepElement(stepName);

        if ($step.attr("validated")) {
            state.nextLocked = false;
            state.backLocked = false;
            return;
        }

        if (validation.validateStep(stepName)) {
            $step.attr("validated", "1");

            maybeShowBackButton();
            fireStepAttribution();

            branching?.applyFromStep(stepName);

            if (visibility?.applyAnswerRules) {
                visibility.applyAnswerRules(stepName);
            }

            const nextStep = steps.getNextStep();
            if (nextStep) {
                steps.switchToStep(nextStep);
                scrollToFormTop();
            }
        }
    });

    $(document).on("change.athenaForm", "input[type='checkbox']", function () {
        state.nextLocked = true;
        state.backLocked = true;

        $(this).removeAttr("solo");

        syncCheckboxGroup(this);

        const identifier = $(this).attr("for");
        syncConditionalFields(identifier);

        updateValidationForElement(this);
    });

    $(document).on("input.athenaForm", "input[type='email']", function () {
        state.nextLocked = true;
        state.backLocked = true;

        $(this).removeAttr("solo");

        updateValidationForElement(this);
    });

    $(document).on(
        "change.athenaForm",
        "input[type='text']:not([honey])",
        function () {
            state.nextLocked = true;
            state.backLocked = true;

            $(this).removeAttr("solo");

            updateValidationForElement(this);
        }
    );

    $(document).on(
        "click.athenaForm",
        "input[type='text']:not([honey]), input[type='email'], #prettyPhone",
        function () {
            $(this).removeAttr("solo");
        }
    );

    $(document).on("change.athenaForm", "select", function () {
        state.nextLocked = true;
        state.backLocked = true;

        $(this).removeAttr("solo");
        $('[name="hdyhau_secondary"]').removeAttr("solo");

        updateValidationForElement(this);
    });

    $(document).on("input.athenaForm", "#prettyPhone", function () {
        state.nextLocked = true;
        state.backLocked = true;

        $(this).removeAttr("solo");

        syncPhoneValue();
        updateValidationForElement(this);
    });

    $(document).on("click.athenaForm", "[mask='proceed'][last]", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        $('[step="info"]').find("input, select").removeAttr("solo");

        validation.updateStepValidationUI("info");
    });

    $(document).on("click.athenaForm", "[cmd='submit_redirect']", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        submitFromCallStep(this, "redirect");
    });

    $(document).on("click.athenaForm", "[cmd='submit_chili']", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        submitFromCallStep(this, "chili");
    });

    $(document).on("click.athenaForm", "[cmd='proceed']", function (e) {
        const $button = $(this);
        const isLast = $button.is("[last]");
        const currentStep = steps.getCurrentStep();

        // Capture the double-click lock before validating: validateStep clears
        // state.nextLocked as it finishes, which would otherwise let a second
        // rapid tap through.
        const wasNextLocked = state.nextLocked;

        if (!canProceedFromStep(currentStep)) {
            e.preventDefault();
            e.stopImmediatePropagation();

            return;
        }

        if (isLast) {
            e.preventDefault();
            e.stopImmediatePropagation();

            if (routeToCallStepIfNeeded(currentStep)) {
                return;
            }

            if ($button.data("is-submitting")) return;

            $button.data("is-submitting", true);
            $button.prop("disabled", true);

            if (window.AthenaForm?.submission?.submit) {
                window.AthenaForm.submission.submit();
            } else if (window.main?.form?.s) {
                window.main.form.s();
            }

            return;
        }

        if (!wasNextLocked) {
            maybeShowBackButton();
            fireStepAttribution();

            branching?.applyFromStep(currentStep);

            if (visibility?.applyAnswerRules) {
                visibility.applyAnswerRules(currentStep);
            }

            const nextStep = steps.getNextStep();

            if (nextStep) {
                steps.switchToStep(nextStep);
                scrollToFormTop();
            }

            state.nextLocked = true;
        }
    });

    $(document).on("click.athenaForm", "[cmd='chili_retry']", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (window.AthenaForm?.chili?.submit) {
            window.AthenaForm.chili.submit();
            return;
        }

        if (window.main?.chili?.submit) {
            window.main.chili.submit();
        }
    });

    $(document).on("click.athenaForm", "[cmd='back']", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (state.backLocked) return;

        const previousStep = steps.getPreviousStep();

        if (previousStep) {
            steps.switchToStep(previousStep);
        }

        state.backLocked = true;
    });

    syncConditionalFields();
}

export function startSystemLoops() {
    if (typeof window.refreshLenis === "function") {
        window.refresher = setInterval(function () {
            window.refreshLenis();
        }, 500);
    }

    window.autofillPoll = setInterval(() => {
        const $search = $(":-internal-autofill-selected");

        if ($search.length) {
            const currentStep = window.AthenaForm?.steps?.getCurrentStep?.();

            if (currentStep) {
                $(`[step="${currentStep}"]`)
                    .find("input, select")
                    .removeAttr("solo");
            }
        }
    }, 500);
}