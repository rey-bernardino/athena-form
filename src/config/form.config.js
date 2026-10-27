// src/config/form.config.js

import { SCORING_RUBRIC } from "./scoring.config.js";

export const FORM_CONFIG = {
  hubspot: {
    region: "na1",
    portalId: "20122740",
    formId: "a7a1a71d-fee0-4c1b-85ea-05aede171179",
    submitBaseUrl: "https://api.hsforms.com/submissions/v3/integration/submit",
  },

  chili: {
    tenant: "athena",
    router: "commercial-round-robin",
    formIds: ["athn_form"],
  },

  fallbackValue: "athena20122740",

  animationTime: 300,

  excludedAttributionSteps: [
    "loading",
    "email",
    "info",
    "loading_chili",
    "calendar",
    "success",
    "error",
    "closed",
  ],

  conditionalFields: [
    {
      field: "hbform_q18_extrahelp",
      value: "other",
      targetSelector: '[conditional="hbform_q18_extrahelp"]',
      secondaryField: "hbform_q18_extrahelp_secondary"
    }
  ],

  optionalBlankFields: [
    "hbform_q18_extrahelp_secondary"
  ],

  progressSteps: [
    "8",
    "v3-6",
    "9",
    "9-founders-pricing",
    "12",
    "13",
    "14",
    "15",
    "v3-7",
    "16",
    "16-founders-hiring",
    "v3-8-q16time",
    "v3-8-q16focus",
    "v3-8-q16calm",
    "v3-8-q16freedom",
    "17",
    "18",
    "18-branch-2",
    "loading",
    "email",
    "info",
    "calendar",
    "success",
  ],

  // Steps that pin the progress bar to 100%. The quiz is over by the time the
  // email step is reached, so everything from there on stays full.
  progressCompleteSteps: [
    "email",
    "info",
    "calendar",
    "loading_chili",
    "success",
  ],

  bannedCountries: [
    "ph",
    "vn",
    "id",
    "in",
    "ng",
    "my",
    "ke",
    "gt",
  ],

  steps: {
    initialStep: "1" //also update no back buttons steps
  },

  noBackButtonSteps: [
    "1",
    "loading",
    "email",
    "loading_chili",
    "calendar",
    "success",
    "error",
    "closed",
  ],

  redirectUrls: {
    bannedCountry: "https://jobs.athena.com",
  },

  branching: {
    enabled: false,

    rules: {
      "1": {
        field: "hbform_q1_worked_with_an_assistant",
        fallbackBranch: ["1"],

        map: {
          "yes_but_not_currently": ["1"],
          "yes_i_have_one_now": ["1"],
          "no_never": ["2"],
        },

      },
      "2": {
        field: "hbform_q2_current_workload",
        fallbackBranch: ["1"],

        map: {
          "overloaded": ["2", "3"],
          "constantly_firefighting": ["3"],
          "manageable": ["2", "3"],
          "busy_but_under_control": ["2", "3"],
        },

      },
    },
  },

  referralRock: {
    enabled: true,
    debug: false,

    paramName: "REFERRALCODE",
    cookieName: "REFERRALCODE",
    legacyCookieName: "_athn",

    utmCookieName: "_athn_utms",
    eligibleCookieName: "_athn_rr_eligible",

    cookieMaxAge: 60 * 60 * 24 * 30,

    exposeLegacyGlobal: true,
  },

  // The rubric itself (questions, points, tiers) is generated into
  // scoring.config.js from scoring/rubrics/. Only the switches live here.
  scoring: {
    enabled: false,

    outputFields: {
      score: "leadscoring_score",
      tier: "leadscoring_tier",
    },

    // Tiers routed to the "we'll be in touch" message instead of the
    // ChiliPiper calendar. [] records the tier without changing routing.
    routing: {
      skipCalendarTiers: ["tier_3"],
    },

    ...SCORING_RUBRIC,
  },

  visibility: {
    enabled: true,

    globalName: "__ATHENA_FLAGS__",

    referrerRules: [
      {
        id: "founders_at_scale",
        referrerIncludes: "foundersatscale.com",
        flag: "founders-at-scale",
      },
    ],

    answerRules: [
      {
        id: "show_q1_yes",
        step: "1",
        field: "hbform_q1_worked_with_an_assistant",
        values: [
          "yes_i_have_one_now",
          "yes_but_not_currently"
        ],
        flag: "hbform_q1_yes",
        action: "enable"
      },
      {
        id: "show_q1_no",
        step: "1",
        field: "hbform_q1_worked_with_an_assistant",
        values: [
          "no_never"
        ],
        flag: "hbform_q1_no",
        action: "enable"
      },
      {
        id: "show_q2_overloaded",
        step: "2",
        field: "hbform_q2_current_workload",
        values: [
          "overloaded",
          "constantly_firefighting"
        ],
        flag: "hbform_q2_overloaded",
        action: "enable"
      },
      {
        id: "show_q2_manageable",
        step: "2",
        field: "hbform_q2_current_workload",
        values: [
          "manageable",
          "busy_but_under_control"
        ],
        flag: "hbform_q2_manageable",
        action: "enable"
      },
      {
        id: "show_q16_time",
        step: "16",
        field: "hbform_q16_what_do_you_want",
        values: [
          "time"
        ],
        flag: "hbform_q16_time",
        action: "enable"
      },
      {
        id: "show_q16_focus",
        step: "16",
        field: "hbform_q16_what_do_you_want",
        values: [
          "focus"
        ],
        flag: "hbform_q16_focus",
        action: "enable"
      },
      {
        id: "show_q16_calm",
        step: "16",
        field: "hbform_q16_what_do_you_want",
        values: [
          "calm"
        ],
        flag: "hbform_q16_calm",
        action: "enable"
      },
      {
        id: "show_q16_freedom",
        step: "16",
        field: "hbform_q16_what_do_you_want",
        values: [
          "freedom",
          "all_four"
        ],
        flag: "hbform_q16_freedom",
        action: "enable"
      },
    ],

    selectors: {
      elements: "[data-athena-show]",
      steps: "[data-athena-step-flag]",
    },

    attributes: {
      elements: "data-athena-show",
      steps: "data-athena-step-flag",
    },
  },

  formSchema: {
    enabled: true,

    outputJsonField: "leadformjson",
    outputVersionField: "leadformversion",

    formVersion: "new_lead_tier_0",
    formEffectivityDate: "2026-10-28",
    formVersionContext: "Official test branch for new lead scoring",

    formSelector: "#athn_form",
    stepSelector: "[step]",

    addedElementSelector: "[context]",

    excludedSteps: [
      "loading",
      "loading_chili",
      "calendar",
      "success",
      "error",
      "closed"
    ],

    excludedHiddenFields: [
      "leadformversion",
      "leadformjson",
      "form_version",
      "form_effectivity_date",
      "form_version_context",
      "form_snapshot_json",
      "form_schema_json",
      "schema_version",
      "cc-num",
      "extra_contact"
    ]
  },
};