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
    "9",
    "9-founders-pricing",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "16-founders-hiring",
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
    "call",
    "call-t3",
    "calendar",
    "loading_chili",
    "success"
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

  noBackButtonSteps: [
    "1",
    "loading",
    "email",
    "loading_chili",
    "calendar",
    "success",
    "error",
    "closed",
    "call",
    "call-t3"
  ],

  redirectUrls: {
    bannedCountry: "https://jobs.athena.com",
  },

  branching: {
    enabled: true,

    rules: {
      "1": {
        field: "hbform_q1_worked_with_an_assistant",
        fallbackBranch: "1",

        map: {
          "yes_but_not_currently": "1",
          "yes_i_have_one_now": "1",
          "no_never": "2",
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
        id: "show_call_step",
        step: "17",
        field: "hbform_q17_timeline",
        value: "asap_this_is_a_priority",
        flag: "call-flow",
        action: "enable",

        // Rule is inert unless Webflow sets
        // window.AthenaForm.webflowGlobals.call = true
        requiresWebflowGlobal: "call"
      }
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

    formVersion: "1.1.1",
    formEffectivityDate: "2026-08-19",
    formVersionContext: "Fixed Phantom Button on mobile",

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

  callStep: {
    redirectUrl: "https://athenago.zoom.us/j/89937607407",

    // Master switch for the whole call flow. Set from Webflow at runtime:
    //   window.AthenaForm.webflowGlobals.call = true
    // When it is absent or falsy, every lead goes through the normal
    // ChiliPiper booking flow. Set requireWebflowGlobal to false to run the
    // call flow off the visibility flag alone (pre-gate behavior).
    requireWebflowGlobal: true,
    webflowGlobalKey: "call"
  },

};