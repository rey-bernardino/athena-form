# athena-form

Modular vanilla-JS rewrite of the Athena signup quiz form. Built with Vite, embedded into a
Webflow page as a single `<script type="module">` tag served from jsDelivr.

## Commands

```bash
npm install
npm run build   # vite build && node scripts/create-webflow-snippet.mjs
```

There are no tests, no linter, and no dev server. Verification is manual, in the browser, on the
Webflow page. Do not add a test framework, formatter, or CI config unless explicitly asked.

## Deployment constraints — read before touching build config

1. **`dist/` is committed on purpose.** jsDelivr serves the built bundle directly out of the
   repo. Do NOT add `dist/` to `.gitignore`. Every functional change requires `npm run build`
   and committing the rebuilt `dist/`.
2. **The repo must stay public** for `cdn.jsdelivr.net/gh/...` URLs to resolve.
3. **`scripts/create-webflow-snippet.mjs` hardcodes the CDN base URL** (owner/repo + `@main`).
   Canonical repo is `rey-bernardino/athena-form`. If the repo is moved, forked, or renamed,
   update that string AND the `<script>` tag in Webflow, or the live form keeps loading the
   old bundle.
4. The snippet pins `@main`, not a commit SHA, so pushing to `main` is the deploy. jsDelivr
   caches; a purge may be needed to see changes immediately.
5. `npm run build` changes the bundle hash, which rewrites `dist/webflow-snippet.html`. The
   Webflow embed must be updated to the new filename on every deploy.

## Runtime environment

Nothing is bundled except `src/`. These are expected as globals, loaded by the Webflow page:

`jQuery` (`$`), `hbspt` (HubSpot forms), `ChiliPiper`, `intlTelInput`, `DOMPurify`, `Webflow`,
`lenis` / `window.refreshLenis`.

Never `import` these. Always guard access (`window.X?.method`) — the existing code does, because
load order isn't guaranteed. `intl-tel-input` utils are dynamically imported from a CDN inside
`phone.service.js`.

## Architecture

Entry: `src/app.js`. Every module is a `createX({ deps })` factory. `app.js` instantiates them
all inside `DOMContentLoaded`, wires dependencies explicitly, then exposes everything on
`window.AthenaForm`. Follow this pattern for new modules — no classes, no singletons other than
`state`.

- `src/config/form.config.js` — **all** configuration. Steps, branching rules, scoring, visibility
  flags, banned countries, HubSpot/ChiliPiper IDs, form schema version. Prefer adding config here
  over hardcoding in modules.
- `src/core/` — `state` (single mutable object), `dom` (selector helpers), `events` (all delegated
  handlers).
- `src/features/` — steps, validation, branching, visibility, scoring, prefill, form-schema,
  submission.
- `src/integrations/` — hubspot, chili, attribution (GA4), referralrock, phone, error-logger.
- `src/ui/` — `animations` (jQuery `.animate`), `field-renderer` (builds custom inputs from the
  hidden HubSpot form).
- `src/utils/` — cookies, url, sanitize, wait-for, random.

### The DOM is the state machine

Markup lives in Webflow, not this repo. Steps are `[step="name"]` elements. Attribute contract:

| Attribute | Meaning |
| --- | --- |
| `[step="n"]` | A step. Current step = the one whose `display !== "none"`. |
| `[skip]` | Removed from the flow (branching, visibility, prefill). |
| `[validated]` | Step passed validation. |
| `[prefilled]` | Answered via URL params; skipped but still reported in the schema. |
| `[ignore]` | Excluded from step/field collection. |
| `solo=""` | Field untouched — suppress validation styling. Removed on interaction. |
| `[branches="1,2"]` | Step belongs to these branches. |
| `[hsfield="a;b"]` | HubSpot fields to render into this step. |
| `[cmd="proceed\|back\|submit_chili\|submit_redirect\|chili_retry"]` | Buttons. |
| `[mask="proceed\|nav_back\|progressbar"]` | Animation wrappers. |
| `[honey]` | Honeypot. |
| `data-athena-show` / `data-athena-step-flag` | Visibility flag requirements. |

Because markup is external, **selectors are the API**. Changing one silently breaks the live form
with no build error. Grep before renaming, and flag any selector change in your summary.

### Submit flow

`submission.controller.js`: honeypot → name/vowel check → banned-country redirect → `loading_chili`
step → scoring → form-schema snapshot → HubSpot v3 POST → then one of:
- `postSubmitAction: "redirect"` → Zoom link from `config.callStep.redirectUrl`
- tier 3 → `error` step reused as a "we'll call you" message
- default → `calendar` step → ChiliPiper booking → `success`

Errors route to the `error` step and are logged by filling a hidden Webflow form
(`error-logger.service.js`).

## Conventions

- 2-space indent, double quotes, semicolons. Named exports only.
- Optional chaining everywhere for cross-module and global calls.
- Comment out debug logs rather than deleting them (existing style).
- Keep the `window.attribution` / `window.checkRRCode` compatibility shell in `app.js` intact —
  legacy Webflow code still calls it.
- When adding a step or changing fields, bump `formSchema.formVersion`,
  `formEffectivityDate`, and `formVersionContext` in the config.

## Known issues at 524d7a3 (pre-existing; fix only if asked)

1. `src/features/progress.controller.js` is dead code — never imported, references `getCurrentStep`
   and `config` that don't exist in its scope. The live implementation is `updateProgressBar` inside
   `steps.controller.js`, which does NOT honor `config.progressCompleteSteps`, so that config key
   currently has no effect.
2. `error-logger.service.js` reads `formData.lead_score` / `lead_tier`, but scoring writes
   `leadscoring_score` / `leadscoring_tier` — those log fields are always empty.
3. Call-flow flags are inconsistent: config's answer rule sets `call-flow`, but `events.js` toggles
   `show-call-step` / `show-call-t3-step`, which appear nowhere in config.
4. `app.js` does `$("#hdyhau_secondary").hide()` (ID) while validation targets
   `[name="hdyhau_secondary"]`.
5. `scripts/create-webflow-snippet.mjs:13` and the generated `dist/webflow-snippet.html` still
   point at the previous owner (`ClickyMcTypey`). Repoint to `rey-bernardino`, rebuild, and
   update the Webflow embed. Fix this before any other change ships.

## Cautions

- HubSpot portal/form IDs and the ChiliPiper tenant/router in the config are client-side by nature,
  but don't add anything genuinely secret to this repo — the whole bundle is public on a CDN.
- `bannedCountries` and scoring `forceTierRules` (competitor email domains) are business logic.
  Don't "clean up" or reformat those lists.
