# Lead scoring

Tooling to derive, test, and ship the lead scoring rubric the form uses to set `leadscoring_score` and `leadscoring_tier`.
The score is computed in the browser at submit time by `src/features/scoring.engine.js` and sent to HubSpot as hidden fields.
The offline tools run that same engine file, so the numbers in the report are the numbers the form will produce.

## Files

| Path | What it is |
|---|---|
| `spec.json` | Derivation inputs: time windows, targets, the live form's questions and options, legacy-value aliases, blocked domains. Hand-edited. |
| `sql/lead_tier_dataset.sql` | Snowflake query: one row per deal, raw submitted answers, 30-day close call outcome. |
| `extract_dataset.py` | Runs the query through the data-sf repo's `sfq.py` and writes the dataset to `.sandbox/` (gitignored, never commit it). |
| `derive.mjs` | Derives a rubric from the dataset and writes `rubrics/<name>.json`. |
| `report.mjs` | Tests a rubric and writes `reports/<name>.html` and `reports/<name>.signoff.md`. |
| `build-config.mjs` | Writes a rubric into `src/config/scoring.config.js`. |
| `rubrics/legacy_b102.json` | The rubric that ran until 2026-10-09, frozen for comparison. |
| `test/` | `npm test`. |

## Running it

```bash
npm run scoring:extract   # needs the data-sf repo at ~/Athena/Dev/data-sf/data-sf and VPN
npm run scoring:derive
npm run scoring:report
open scoring/reports/lead_tier_v0.html
npm run scoring:config
npm test
```

`scoring:report` exits non-zero if the legacy rubric, replayed through the engine, fails to reproduce every score stored at submit time.
That check guards both the engine and the dataset; do not ship if it fails.

## How a rubric is derived

The outcome is a close call completed within 30 days of deal creation, among deals with a recorded call outcome and at least 30 days old.
Windows are split on deal creation date, never at random: points are derived on the baseline window and every headline result is on the later test window.

Within a question, each answer's completion rate is shrunk toward the baseline, the weakest answer earns 0 and the strongest earns the question's cap.
Each question's cap comes from one of two methods, chosen by AUC on the last month of the baseline (the validation month) so the choice never looks at the test window:

- `exam` weighs each question by how far apart its answers' rates are.
- `fitted` weighs questions by a regularized logistic regression over all of them at once, so overlapping questions do not double count.

Both discount questions that few leads were asked.
The score is the percentage of available points a lead earned on the questions they were asked, so leads on different form versions are comparable.
Tier 1 is the widest "score at or above" group whose baseline completion meets `targets.tier1MinRate`; tier 3 is the widest "score below" group at or under `targets.tier3MaxRate`.

## Shipping a rubric

1. Growth approves the sign-off sheet (`reports/<name>.signoff.md`).
2. If Growth hands back a different rubric, edit or replace `rubrics/<name>.json` (the engine keys: `questions[].options`, `maxPoints`, `defaultPoints`, `tiers`) and rerun `scoring:report` on it before generating the config.
3. `npm run scoring:config`, then `npm test` (fails if `scoring.config.js` and the rubric JSON drift).
4. In `src/config/form.config.js`, set `scoring.enabled: true` and confirm `scoring.routing.skipCalendarTiers`.
5. `npm run build` and merge to the branch the Webflow snippet serves from (`transition`).

## Switches in `form.config.js`

- `scoring.enabled`: compute and send the score. Off sends nothing, so HubSpot keeps whatever it had.
- `scoring.routing.skipCalendarTiers`: tiers shown "we'll be in touch" instead of the ChiliPiper calendar. `[]` records tiers without changing routing.

## Refreshing

Rerun the whole sequence monthly or after a form change.
Slide `spec.windows` forward so the test window stays the latest three months whose 30 days are up.
When the form gains or changes a question, update `spec.json` questions and options from the form's `leadformjson` catalogue (`MISC_SCHEMA.MISC_HS_FORM_VERSION`) and map retired spellings in `aliases`.
