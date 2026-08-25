// src/ui/animations.js

export function createAnimations({ config }) {
  const animationTime = config.animationTime || 300;

  function refreshLenisSafe() {
    if (typeof window.refreshLenis === "function") {
      window.refreshLenis();
    }
  }

  function getContinueMaskHeight($mask, $button) {
    const buttonHeight = $button.outerHeight(true);

    const paddingTop = parseFloat($mask.css("padding-top")) || 0;
    const paddingBottom = parseFloat($mask.css("padding-bottom")) || 0;

    return buttonHeight + paddingTop + paddingBottom;
  }

  return {
    toggleBackButton(mode) {
      const $mask = $("[mask=nav_back]");

      if (mode === "show") {
        const $button = $mask.children("div");
        $mask.animate(
          { width: `${$button.outerWidth(true)}px` },
          animationTime
        );
      } else {
        $mask.animate({ width: "0px" }, animationTime);
      }
    },

    toggleProgressBar(mode) {
      const $mask = $("[mask=progressbar]");

      if (mode === "show") {
        const $bar = $mask.children("div");
        $mask
          .delay(100)
          .animate(
            { height: `${$bar.outerHeight(true)}px` },
            animationTime + 100
          );
      } else {
        $mask.animate({ height: "0px" }, animationTime);
      }
    },

    toggleContinueButton(mode, targetStep) {
      const $step = $(`[step="${targetStep}"]`);

      const $continueMask = $step
        .find("[mask=proceed]")
        .not(":has([last])");

      const $submitBtn = $step.find("[cmd=proceed][last]");

      $continueMask.finish();

      const isSubmitStep = String(targetStep) === "info";

      if (mode === "show") {
        if (isSubmitStep && $submitBtn.length) {
          $submitBtn
            .prop("disabled", false)
            .removeClass("disabled")
            .css("pointer-events", "");

          return;
        }

        const $continueButton = $continueMask.children("div");

        // Re-arm before animating so the button is tappable as it appears.
        $continueMask.css("pointer-events", "");

        $continueMask
          .animate(
            {
              height: `${getContinueMaskHeight($continueMask, $continueButton)}px`,
              opacity: 1,
            },
            animationTime
          )
          .queue(function (next) {
            refreshLenisSafe();
            next();
          });

        return;
      }

      if (isSubmitStep && $submitBtn.length) {
        // disabled alone is not enough — the proceed control is often a div,
        // where the property is inert.
        $submitBtn
          .prop("disabled", true)
          .addClass("disabled")
          .css("pointer-events", "none");

        return;
      }

      // Kill taps immediately, not when the animation lands. The mask collapses
      // to height/opacity 0 but keeps its hit area (and on mobile it is fixed to
      // the bottom of the viewport), so it stays tappable while invisible.
      $continueMask.css("pointer-events", "none");

      $continueMask
        .animate(
          {
            height: "0px",
            opacity: 0,
          },
          animationTime
        )
        .queue(function (next) {
          refreshLenisSafe();
          next();
        });
    },

    fadeInForm() {
      $(".signup-b-content-default").animate({ opacity: 1 }, 1000);
    },

    fadeOutLeft(element) {
      const $el = $(element);

      $el.animate({ left: "-10%", opacity: 0 }, animationTime, () => {
        const originalDisplay = $el.css("display");

        $el.attr("originalDisplay", originalDisplay);
        $el.css({
          display: "none",
          left: "0",
        });
      });
    },

    fadeInLeft(element, callback) {
      const $el = $(element);
      const originalDisplay = $el.attr("originalDisplay");

      $el.css({
        left: "-15%",
        opacity: 0,
        display: originalDisplay || "block",
      });

      $el
        .delay(100)
        .animate(
          { left: "0", opacity: 1 },
          animationTime + 100
        )
        .queue(function (next) {
          refreshLenisSafe();

          if (typeof callback === "function") {
            callback();
          }

          next();
        });
    },

    fadeOutRight(element) {
      const $el = $(element);

      $el.animate({ right: "-10%", opacity: 0 }, animationTime, () => {
        const originalDisplay = $el.css("display");

        $el.attr("originalDisplay", originalDisplay);
        $el.css({
          display: "none",
          right: "0",
        });
      });
    },

    fadeInRight(element, callback) {
      const $el = $(element);
      const originalDisplay = $el.attr("originalDisplay");

      $el.css({
        right: "-15%",
        opacity: 0,
        display: originalDisplay || "block",
      });

      $el
        .delay(100)
        .animate(
          { right: "0", opacity: 1 },
          animationTime + 100
        )
        .queue(function (next) {
          refreshLenisSafe();

          if (typeof callback === "function") {
            callback();
          }

          next();
        });
    },
  };
}