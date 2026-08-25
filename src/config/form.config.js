// src/config/form.config.js

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

  progressSteps: [
    "9",
    "loading",
    "email",
    "info",
    "calendar",
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

  scoring: {
    enabled: true,

    outputFields: {
      score: "leadscoring_score",
      tier: "leadscoring_tier",
    },

    tiers: [
      {
        name: "tier_1",
        minScore: 13,
      },
      {
        name: "tier_2",
        minScore: 5,
      },
      {
        name: "tier_3",
        minScore: 0,
      },
    ],

    forceTierRules: [
      {
        id: "blocked_email_domain",
        type: "email_domain",
        field: "email",
        tier: "tier_3",
        domains: [
          "redwirespace.com",
          "maxspace.com",
          "mytimein.io",
          "thedanielramsey.com",
          "ascendbuild.co",
          "bruntwork.co",
          "getmagic.com",
          "wingassistant.com",
          "myoutdesk.com",
          "pearltalent.com",
        ],
      },
    ],

    questions: [
      {
        id: "hbform_q1_worked_with_an_assistant",
        source: "field",
        field: "hbform_q1_worked_with_an_assistant",
        maxPoints: 6,

        options: {
          "yes_i_have_one_now": 6,
          "yes_but_not_currently": 6,
        },
      },

      {
        id: "hbform_q2_current_workload",
        source: "field",
        field: "hbform_q2_current_workload",
        maxPoints: 6,

        options: {
          "overloaded": 6,
          "constantly_firefighting": 6,
        },
      },

      {
        id: "hbform_q5_day_to_day_tasks",
        source: "field",
        field: "hbform_q5_day_to_day_tasks",
        maxPoints: 6,

        options: {
          "calendar__scheduling": 6,
          "email_inbox_management": 6,
        },
      },

      {
        id: "hbform_q7_personal_logistics",
        source: "field",
        field: "hbform_q7_personal_logistics",
        maxPoints: 6,

        options: {
          "travel_logistics_for_personal_trips": 6,
        },
      },

      {
        id: "hbform_q17_timeline",
        source: "field",
        field: "hbform_q17_timeline",
        maxPoints: 6,

        options: {
          "asap_this_is_a_priority": 6,
        },
      },

      {
        id: "hdyhau_primary",
        source: "field",
        field: "hdyhau_primary",
        maxPoints: 25,

        options: {
          "Referral": 25,
        },
      },

      {
        id: "utm_medium_referral",
        source: "utm",
        field: "utm_medium",
        maxPoints: 25,

        options: {
          "clientreferral": 25,
        },
      },

      {
        id: "utm_medium_affiliate",
        source: "utm",
        field: "utm_medium",
        maxPoints: 5,

        options: {
          "affiliate": 5,
        },
      },
    ],
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

    formVersion: "B 1.0.2",
    formEffectivityDate: "2026-08-25",
    formVersionContext: "V3 adding progress bar and step 18",

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