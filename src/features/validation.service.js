// src/features/validation.service.js

export function createValidationService({
  state,
  config,
  animations,
}) {

  function isOptionalBlankField(name, value) {
    const optionalBlankFields = config.optionalBlankFields || [];

    return (
      optionalBlankFields.includes(String(name)) &&
      String(value || "").trim() === ""
    );
  }

  function validateEmail(email) {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(String(email).toLowerCase());
  }

  function getUniqueFieldNames($step) {
    const names = [];

    $step.find("input[name], select[name], textarea[name]").not("[ignore]").each(function () {
      const name = $(this).attr("name");

      if (name && !names.includes(name)) {
        names.push(name);
      }
    });

    return names;
  }

  function hasInvalidEmailDots(email) {
    const value = String(email || "").trim();

    if (value.includes("..")) return true;

    const [localPart, domainPart] = value.split("@");

    if (!localPart || !domainPart) return true;

    if (localPart.startsWith(".") || localPart.endsWith(".")) return true;
    if (domainPart.startsWith(".") || domainPart.endsWith(".")) return true;

    return domainPart
      .split(".")
      .some((part) => !part || part.startsWith("-") || part.endsWith("-"));
  }

  function findFieldByName($step, name) {
    return $step.find("input[name], select[name]").filter(function () {
      return $(this).attr("name") === name;
    });
  }

  function getValidationWrapper($element) {
    const $wrapper = $element.closest(".signup-input");

    if ($wrapper.length) {
      return $wrapper;
    }

    return $element.parent();
  }

  function markInvalid($element) {
    getValidationWrapper($element).addClass("invalid");
  }

  function markValid($element) {
    getValidationWrapper($element).removeClass("invalid");
  }

  function isNameField(name) {
    return ["firstname", "lastname"].includes(String(name));
  }

  function hasOnlyNumbers(value) {
    return /^[0-9\s]+$/.test(String(value || "").trim());
  }

  function shouldValidateField($element) {
    // In your form, solo="" means untouched / do not show validation yet.
    // Once solo is removed, validation should run.
    return $element.attr("solo") !== "";
  }

  function updateHdyhauSecondary(primaryValue, step) {
    const placeholders = {
      Podcast: "Which podcast?",
      Referral: "Referrer's name (first and last)",
      Newsletter: "Which newsletter?",
      "Blog or Publication": "Which website?",
      Events: "Which event did you attend?",
      Other: "Please specify:",
    };

    const $secondary = $(
      `[step="${step}"] [name="hdyhau_secondary"]`
    );

    if (!$secondary.length) return;

    if (placeholders[primaryValue]) {
      $secondary.attr("placeholder", placeholders[primaryValue]);

      if ($secondary.val() === config.fallbackValue) {
        $secondary.val(null);
      }

      $secondary.show();
      return;
    }

    $secondary.hide();
    $secondary.val(config.fallbackValue);
  }

  function validateRadioField($step, name) {
    const $checked = findFieldByName($step, name)
      .filter(":radio")
      .filter(":checked");

    if (!$step.find(`input[type="radio"]`).filter(function () {
      return $(this).attr("name") === name;
    }).length) {
      return null;
    }

    return $checked.length > 0;
  }

  function validateCheckboxField($step, name) {
    const $hidden = findFieldByName($step, name).filter(":hidden");

    // Only treat hidden fields as checkbox aggregators
    // if there are actual checkbox inputs using for="fieldName"
    const $checkboxes = $step.find(`input[type="checkbox"][for="${name}"]`);

    if (!$hidden.length || !$checkboxes.length) return null;

    let isValid = false;

    $hidden.each(function () {
      const minimum = Number($(this).attr("min") || 1);
      const currentValue = $(this).val();

      if (!currentValue) return;

      const selectedValues = String(currentValue)
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean);

      if (selectedValues.length >= minimum) {
        isValid = true;
      }
    });

    return isValid;
  }

  function validateConsentField($step, name) {
    const $consent = $step
      .find(".signup-input.consent input[name]")
      .filter(function () {
        return $(this).attr("name") === name;
      });

    if (!$consent.length) return null;

    const shouldValidate = $consent.toArray().some((el) => {
      return shouldValidateField($(el));
    });

    if (!shouldValidate) {
      return false;
    }

    const isChecked = $consent.filter(":checked").length > 0;

    if (isChecked) {
      $consent.closest(".signup-input").removeClass("invalid");
    } else {
      $consent.closest(".signup-input").addClass("invalid");
    }

    return isChecked;
  }

  function validateEmailField($step, name) {
    const $email = findFieldByName($step, name).filter('[type="email"]');

    if (!$email.length) return null;

    let isValid = true;

    $email.each(function () {
      const $field = $(this);
      const value = String($field.val() || "").trim();

      if (validateEmail(value) && !hasInvalidEmailDots(value)) {
        markValid($field);
      } else {
        markInvalid($field);
        isValid = false;
      }
    });

    return isValid;
  }

  function validateSelectField($step, name, step) {
    const $select = findFieldByName($step, name).filter("select");

    if (!$select.length) return null;

    let isValid = true;

    $select.each(function () {
      const $field = $(this);

      if (!shouldValidateField($field)) {
        isValid = false;
        return;
      }

      const value = $field.val();

      if (name.includes("hdyhau_primary")) {
        updateHdyhauSecondary(value, step);
      }

      if (value === null || value === "") {
        markInvalid($field);
        isValid = false;
      } else {
        markValid($field);
      }
    });

    return isValid;
  }

  function validatePhoneField($step, name) {
    const $phone = $step.find("#prettyPhone").filter(function () {
      return $(this).attr("for") === name;
    });

    if (!$phone.length) return null;

    let isValid = true;

    $phone.each(function () {
      const $field = $(this);

      if (!shouldValidateField($field)) {
        isValid = false;
        return;
      }

      const phoneInstance = state.phoneInstance || window.iti;

      const rawValue = String($field.val() || "").trim();
      const digitsOnly = rawValue.replace(/\D/g, "");

      const pluginValid = Boolean(phoneInstance?.isValidNumber?.());

      // Extra guard: prevent short fake values like 123
      const hasEnoughDigits = digitsOnly.length >= 7;

      if (pluginValid && hasEnoughDigits) {
        $field.closest(".signup-input").removeClass("invalid");
      } else {
        $field.closest(".signup-input").addClass("invalid");
        isValid = false;
      }
    });

    return isValid;
  }

  function validateTextField($step, name) {
    const $text = findFieldByName($step, name).filter(
      'input[type="text"], textarea'
    );

    if (!$text.length) return null;

    let isValid = true;

    $text.each(function () {
      const $field = $(this);
      const value = String($field.val() || "").trim();

      // Allow configured optional fields to be blank
      // even if they are hidden or untouched.
      if (isOptionalBlankField(name, value)) {
        markValid($field);
        return;
      }

      if (!shouldValidateField($field)) {
        isValid = false;
        return;
      }

      if (!value) {
        markInvalid($field);
        isValid = false;
      } else if (isNameField(name) && hasOnlyNumbers(value)) {
        markInvalid($field);
        isValid = false;
      } else {
        markValid($field);
      }
    });

    return isValid;
  }

  function validateStep(step) {
    state.nextLocked = true;
    state.backLocked = true;

    const $step = $(`[step="${step}"]`);
    const fieldNames = getUniqueFieldNames($step);

    if (!fieldNames.length) {
      state.nextLocked = false;
      state.backLocked = false;
      return false;
    }

    let validationTarget = 0;
    let validatedFields = 0;

    fieldNames.forEach((name) => {
      const validators = [
        validateRadioField,
        validateCheckboxField,
        validateConsentField,
        validateEmailField,
        validateSelectField,
        validatePhoneField,
        validateTextField,
      ];

      for (const validator of validators) {
        const result = validator($step, name, step);

        if (result === null) continue;

        validationTarget++;

        if (result === true) {
          validatedFields++;
        }

        break;
      }
    });

    const isValid =
      validationTarget > 0 &&
      validatedFields === validationTarget;

    state.nextLocked = false;
    state.backLocked = false;

    return isValid;
  }

  function updateStepValidationUI(step) {
    const isValid = validateStep(step);
    const $step = $(`[step="${step}"]`);

    if (isValid) {
      $step.attr("validated", "1");
      animations.toggleContinueButton("show", step);
    } else {
      $step.removeAttr("validated");
      animations.toggleContinueButton("hide", step);
    }

    return isValid;
  }

  return {
    validateStep,
    updateStepValidationUI,
    validateEmail,
  };
}