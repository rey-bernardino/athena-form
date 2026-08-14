// src/features/steps.controller.js
import { getRandomDelay } from "../utils/random.js";

export function createStepsController({
  dom,
  state,
  config,
  animations,
}) {

  function shouldHideBackButton(stepName) {
    return config.noBackButtonSteps?.includes(String(stepName));
  }

  function updateBackButtonForStep(stepName) {
    if (shouldHideBackButton(stepName)) {
      animations.toggleBackButton("hide");
    } else {
      animations.toggleBackButton("show");
    }
  }

  function getVisibleStepElements() {
    return Object.values($("[step]").not("[skip]"));
  }

  function getCurrentStep() {
    let currentStep = null;

    $("[step]").not("[skip]").each(function () {
      if ($(this).css("display") !== "none") {
        currentStep = $(this).attr("step");
      }
    });

    state.currentStep = currentStep;
    return currentStep;
  }

  function getNextStep() {
    const currentStep = getCurrentStep();
    const currentElement = $(`[step="${currentStep}"]`)[0];
    const steps = getVisibleStepElements();

    const currentIndex = steps.indexOf(currentElement);
    const nextElement = steps[currentIndex + 1];

    return nextElement ? $(nextElement).attr("step") : null;
  }

  function getPreviousStep() {
    const currentStep = getCurrentStep();
    const currentElement = $(`[step="${currentStep}"]`)[0];
    const steps = getVisibleStepElements();

    const currentIndex = steps.indexOf(currentElement);
    const previousElement = steps[currentIndex - 1];

    return previousElement ? $(previousElement).attr("step") : null;
  }

  function getSteps() {
    const previousStep = getPreviousStep();
    const nextStep = getNextStep();

    const previousStepElement = $(`[step="${previousStep}"]`)[0];
    const nextStepElement = $(`[step="${nextStep}"]`)[0];

    const steps = getVisibleStepElements();

    const previousStepIndex = steps.indexOf(previousStepElement);
    const nextStepIndex = steps.indexOf(nextStepElement);

    return [previousStepIndex, nextStepIndex];
  }

  function getProgressCompleteSteps() {
    return (config.progressCompleteSteps || []).map(String);
  }

  // Steps that must not count toward the quiz total: the non-quiz interstitials
  // plus every step that is already "complete" (email onward).
  function buildProgressExclusionSelector() {
    const excluded = new Set([
      "error",
      "loading",
      "loading_chili",
      "closed",
      ...getProgressCompleteSteps(),
    ]);

    return [...excluded]
      .map((step) => `[step="${step}"]`)
      .concat("[skip]")
      .join(", ");
  }

  function updateProgressBar() {
    const $bar = dom.getProgressBar();

    if (!$bar.length) return;

    const currentStep = getCurrentStep();

    // Mid-transition there is no visible step. Leave the bar alone rather than
    // snapping it to 0.
    if (!currentStep) return;

    // email onward the quiz is finished — hold the bar at 100%.
    if (getProgressCompleteSteps().includes(String(currentStep))) {
      $bar.css("width", "100%");
      return;
    }

    const $steps = $("[step]").not(buildProgressExclusionSelector());

    const length = $steps.length;
    if (!length) return;

    const currentElement = $(`[step="${currentStep}"]`)[0];
    const rawIndex = $steps.index(currentElement);

    // Current step is not part of the counted set (error, closed, a [skip]ped
    // branch). Hold the previous width instead of resetting to 0.
    if (rawIndex < 0) return;

    const percentage = ((rawIndex + 1) / length) * 100;

    $bar.css("width", `${percentage}%`);
  }

  function shouldShowProgressBar(targetStepName) {
    return config.progressSteps.includes(targetStepName);
  }

  function stepInit() {
    state.backLocked = false;
    state.nextLocked = false;

    updateProgressBar();

    const currentStep = getCurrentStep();

    if (shouldHideBackButton(currentStep)) {
      animations.toggleBackButton("hide");
    }

    if (currentStep === "loading") {
      const xp = Math.floor(Math.random() * 4) + 3;
      $("#xp_num").html(xp);

      $("[step=loading]")
        .delay(getRandomDelay(3000, 5000))
        .queue(function (next) {
          animations.fadeOutLeft($("[step=loading]"));
          animations.fadeInRight($("[step=email]"));
          next();
        });
    }

    if (currentStep === "email") {
      const $loadingStep = $("[step=loading]");

      if ($loadingStep.length) {
        $loadingStep.remove();
      }
    }
  }

  function switchToStep(targetStep) {
    const currentStep = getCurrentStep();

    const currentStepElement = $(`[step="${currentStep}"]`)[0];
    const destinationStepElement = $(`[step="${targetStep}"]`)[0];

    if (!currentStepElement || !destinationStepElement) return;

    const targetStepName = $(destinationStepElement).attr("step");
    updateBackButtonForStep(targetStepName);
    const steps = getVisibleStepElements();

    const currentStepIndex = steps.indexOf(currentStepElement);
    const destinationStepIndex = steps.indexOf(destinationStepElement);

    const isDestinationValidated = $(destinationStepElement)
      .closest("[step]")
      .attr("validated");

    if (isDestinationValidated) {
      const $targetProceedMask = $(`[step="${targetStep}"] [mask=proceed]`);

      if ($targetProceedMask.css("height") === "0px") {
        $targetProceedMask.css({
          height: "auto",
          opacity: 1,
        });
      }
    }

    if (shouldShowProgressBar(targetStepName)) {
      animations.toggleProgressBar("show");
    } else {
      animations.toggleProgressBar("hide");
    }

    if (shouldHideBackButton(targetStepName)) {
      animations.toggleBackButton("hide");
    }

    if (currentStepIndex > destinationStepIndex) {
      animations.fadeOutRight(currentStepElement);
      animations.fadeInLeft(destinationStepElement, stepInit);
    }

    if (currentStepIndex < destinationStepIndex) {
      animations.fadeOutLeft(currentStepElement);
      animations.fadeInRight(destinationStepElement, stepInit);
    }

    updateProgressBar();
  }

  return {
    getCurrentStep,
    getNextStep,
    getPreviousStep,
    getSteps,
    switchToStep,
    stepInit,
    updateProgressBar,
  };
}