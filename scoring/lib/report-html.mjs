// Self-contained HTML report: no network, no warehouse, aggregates only.

const pct = (value, digits = 1) => (value === null || value === undefined ? "-" : `${(100 * value).toFixed(digits)}%`);
const num = (value) => (value === null || value === undefined ? "-" : value.toLocaleString("en-US"));
const auc = (value) => (value === null || value === undefined ? "-" : value.toFixed(3));
const pp = (value) => (value === null || value === undefined ? "-" : `${(100 * value).toFixed(1)} pp`);

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const TIER_LABELS = { tier_1: "Tier 1", tier_2: "Tier 2", tier_3: "Tier 3" };

function tierFor(score, tiers) {
  return [...tiers].sort((a, b) => b.minScore - a.minScore).find((tier) => score >= tier.minScore)?.name;
}

function headlineTable(evaluation) {
  const rows = [
    ["New rubric (lead_tier_v0)", evaluation.candidate],
    ["Current rubric (legacy, as it ran until Oct 9)", evaluation.current],
  ];

  return `
    <table>
      <thead><tr>
        <th>Rubric</th><th class="n">AUC test</th><th class="n">AUC baseline</th>
        <th class="n">Bottom 20% rate</th><th class="n">Top 20% rate</th><th class="n">Spread</th>
        <th class="n">Top 20% capture</th>
      </tr></thead>
      <tbody>
        ${rows
          .map(
            ([label, result]) => `<tr>
              <td>${label}</td>
              <td class="n strong">${auc(result.test.summary.auc)}</td>
              <td class="n">${auc(result.baseline.summary.auc)}</td>
              <td class="n">${pct(result.test.summary.bottomQuintile)}</td>
              <td class="n">${pct(result.test.summary.topQuintile)}</td>
              <td class="n">${pp(result.test.summary.spread)}</td>
              <td class="n">${pct(result.test.summary.top20Capture, 0)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function tierRows(result) {
  return result.tiers
    .map(
      (tier) => `<tr>
        <td><span class="swatch ${tier.tier}"></span>${TIER_LABELS[tier.tier]}</td>
        <td class="n">${num(tier.n)}</td>
        <td class="n">${pct(tier.share, 0)}</td>
        <td class="n strong">${pct(tier.rate)}</td>
        <td class="n">${pct(tier.allLeads.rate)}</td>
      </tr>`
    )
    .join("");
}

function tierTables(evaluation) {
  const block = (title, result) => `
    <div>
      <h3>${title}</h3>
      <table>
        <thead><tr><th>Tier</th><th class="n">Leads</th><th class="n">Share</th>
          <th class="n">Completion</th><th class="n">Completion, all leads</th></tr></thead>
        <tbody>${tierRows(result)}</tbody>
      </table>
    </div>`;

  return `<div class="pair">
    ${block("New rubric, test window", evaluation.candidate.test)}
    ${block("Current rubric, test window", evaluation.current.test)}
  </div>`;
}

// Columns of completion rate per 10-point band, colored by the tier the band
// falls in. Thin bands are faded so a handful of deals cannot read as a finding.
function bandChart(evaluation) {
  const { tiers } = evaluation.rubric;
  const width = 720;
  const height = 280;
  const margin = { top: 24, right: 16, bottom: 40, left: 44 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const slot = plotW / evaluation.bands.length;
  const barW = Math.min(24, slot * 0.6);
  const y = (value) => margin.top + plotH * (1 - value);
  const target = evaluation.spec.targets.tier1MinRate;

  const grid = [0, 0.2, 0.4, 0.6, 0.8, 1]
    .map(
      (tick) => `<line class="grid" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}"/>
        <text class="tick" x="${margin.left - 8}" y="${y(tick) + 4}" text-anchor="end">${tick * 100}%</text>`
    )
    .join("");

  const bars = evaluation.bands
    .map((band, index) => {
      const low = Number(band.label.split("-")[0]);
      const tier = tierFor(low, tiers);
      const cx = margin.left + slot * index + slot / 2;
      const thin = band.n < 25;
      const tip = `Score ${band.label}: ${pct(band.rate)} completion, ${num(band.n)} leads, ${TIER_LABELS[tier]}`;
      const label = `<text class="tick" x="${cx}" y="${height - margin.bottom + 16}" text-anchor="middle">${band.label}</text>`;

      if (!band.n) return label;

      const top = y(band.rate);
      const h = margin.top + plotH - top;
      const r = Math.min(4, h);
      const x = cx - barW / 2;

      return `<g class="hit" data-tip="${escapeHtml(tip)}">
          <rect x="${cx - slot / 2}" y="${margin.top}" width="${slot}" height="${plotH}" fill="transparent"/>
          <path class="bar ${tier}${thin ? " thin" : ""}" d="M${x},${margin.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${margin.top + plotH} Z"/>
          ${band.n >= 25 ? `<text class="value" x="${cx}" y="${top - 6}" text-anchor="middle">${Math.round(100 * band.rate)}%</text>` : ""}
        </g>${label}`;
    })
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Completion rate by score band, test window">
    ${grid}
    <line class="axis" x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + plotH}" y2="${margin.top + plotH}"/>
    <line class="ref" x1="${margin.left}" x2="${width - margin.right}" y1="${y(target)}" y2="${y(target)}"/>
    <text class="ref-label" x="${margin.left + 6}" y="${y(target) - 6}">Tier 1 goal ${target * 100}%</text>
    ${bars}
    <text class="tick" x="${margin.left + plotW / 2}" y="${height - 6}" text-anchor="middle">Score band</text>
  </svg>`;
}

// Completion among leads scoring at or above each cutoff, baseline vs test.
function sweepChart(evaluation) {
  const width = 720;
  const height = 300;
  const margin = { top: 24, right: 84, bottom: 40, left: 44 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const minRate = 0.3;
  const x = (cutoff) => margin.left + (plotW * cutoff) / 100;
  const y = (value) => margin.top + plotH * (1 - (value - minRate) / (1 - minRate));
  const target = evaluation.spec.targets.tier1MinRate;
  const tier1 = evaluation.verdict.tier1Cutoff;
  const minDeals = evaluation.spec.targets.minTierDeals;

  const series = [
    { key: "test", label: "Test", cls: "s1" },
    { key: "baseline", label: "Baseline", cls: "s2" },
  ].map((entry) => {
    const points = evaluation.sweep[entry.key].filter((point) => point.nAbove >= minDeals);
    const d = points.map((point, i) => `${i ? "L" : "M"}${x(point.cutoff).toFixed(1)},${y(point.rateAbove).toFixed(1)}`).join(" ");
    const last = points[points.length - 1];

    return { ...entry, points, d, last };
  });

  const grid = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
    .map(
      (tick) => `<line class="grid" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}"/>
        <text class="tick" x="${margin.left - 8}" y="${y(tick) + 4}" text-anchor="end">${Math.round(tick * 100)}%</text>`
    )
    .join("");

  const xTicks = [0, 20, 40, 60, 80, 100]
    .map((tick) => `<text class="tick" x="${x(tick)}" y="${height - margin.bottom + 16}" text-anchor="middle">${tick}</text>`)
    .join("");

  const sweepData = evaluation.sweep.test.map((point, i) => ({
    c: point.cutoff,
    t: point.nAbove >= minDeals ? point.rateAbove : null,
    ts: point.shareAbove,
    b: evaluation.sweep.baseline[i].nAbove >= minDeals ? evaluation.sweep.baseline[i].rateAbove : null,
    bs: evaluation.sweep.baseline[i].shareAbove,
  }));

  return `<svg id="sweep" viewBox="0 0 ${width} ${height}" role="img" aria-label="Completion rate at or above each cutoff"
      data-sweep='${escapeHtml(JSON.stringify(sweepData))}' data-x0="${margin.left}" data-pw="${plotW}">
    ${grid}${xTicks}
    <line class="axis" x1="${margin.left}" x2="${width - margin.right}" y1="${margin.top + plotH}" y2="${margin.top + plotH}"/>
    <line class="ref" x1="${margin.left}" x2="${width - margin.right}" y1="${y(target)}" y2="${y(target)}"/>
    <text class="ref-label" x="${margin.left + 6}" y="${y(target) - 6}">Tier 1 goal ${target * 100}%</text>
    <line class="cut" x1="${x(tier1)}" x2="${x(tier1)}" y1="${margin.top}" y2="${margin.top + plotH}"/>
    <text class="ref-label" x="${x(tier1) + 6}" y="${margin.top + 12}">Tier 1 cutoff ${tier1}</text>
    ${series
      .map(
        (entry) => `<path class="line ${entry.cls}" d="${entry.d}"/>
          <circle class="dot ${entry.cls}" cx="${x(entry.last.cutoff)}" cy="${y(entry.last.rateAbove)}" r="4"/>
          <text class="value" x="${x(entry.last.cutoff)}" y="${y(entry.last.rateAbove) - 10}" text-anchor="middle">${entry.label}</text>`
      )
      .join("")}
    <line id="crosshair" class="crosshair" x1="0" x2="0" y1="${margin.top}" y2="${margin.top + plotH}" visibility="hidden"/>
    <rect id="sweep-hit" x="${margin.left}" y="${margin.top}" width="${plotW}" height="${plotH}" fill="transparent"/>
    <text class="tick" x="${margin.left + plotW / 2}" y="${height - 6}" text-anchor="middle">Cutoff (score at or above)</text>
  </svg>`;
}

function sweepTable(evaluation) {
  const rows = [];

  for (let cutoff = 40; cutoff <= 90; cutoff += 5) {
    const test = evaluation.sweep.test[cutoff];
    const base = evaluation.sweep.baseline[cutoff];
    const marker = cutoff === evaluation.verdict.tier1Cutoff ? " class=\"chosen\"" : "";

    rows.push(`<tr${marker}>
      <td class="n">${cutoff}</td>
      <td class="n">${pct(test.shareAbove, 0)}</td><td class="n strong">${pct(test.rateAbove)}</td><td class="n">${pct(test.rateBelow)}</td>
      <td class="n">${pct(base.shareAbove, 0)}</td><td class="n">${pct(base.rateAbove)}</td><td class="n">${pct(base.rateBelow)}</td>
    </tr>`);
  }

  return `<table>
    <thead>
      <tr><th></th><th colspan="3" class="group">Test window</th><th colspan="3" class="group">Baseline window</th></tr>
      <tr><th class="n">Cutoff</th>
        <th class="n">Share at or above</th><th class="n">Completion at or above</th><th class="n">Completion below</th>
        <th class="n">Share at or above</th><th class="n">Completion at or above</th><th class="n">Completion below</th></tr>
    </thead>
    <tbody>${rows.join("")}</tbody>
  </table>`;
}

function rubricTables(evaluation) {
  const { rubric } = evaluation;
  const totalPoints = rubric.questions.reduce((sum, question) => sum + question.maxPoints, 0);

  const scored = [...rubric.diagnostics]
    .filter((question) => question.cap > 0)
    .sort((a, b) => b.cap - a.cap)
    .map(
      (question) => `<details>
        <summary><span class="cap">${question.cap}</span> ${escapeHtml(question.label)}
          <span class="muted">${pct(question.cap / totalPoints, 0)} of the score, ${num(question.coverage)} baseline leads</span></summary>
        <table class="options">
          <thead><tr><th>Answer</th><th class="n">Points</th><th class="n">Completion</th><th class="n">Baseline leads</th></tr></thead>
          <tbody>
            ${question.options
              .map(
                (option) => `<tr${option.kept ? "" : " class=\"faded\""}>
                  <td>${escapeHtml(option.label)}${option.kept ? "" : " <span class=\"muted\">(too few leads, neutral points)</span>"}</td>
                  <td class="n strong">${option.points}</td>
                  <td class="n">${pct(option.rate)}</td>
                  <td class="n">${num(option.n)}</td>
                </tr>`
              )
              .join("")}
            <tr class="faded"><td>Any other answer</td><td class="n strong">${question.defaultPoints}</td><td class="n">-</td><td class="n">-</td></tr>
          </tbody>
        </table>
      </details>`
    )
    .join("");

  const unscored = rubric.unscored.map((question) => `<li>${escapeHtml(question.label)}</li>`).join("");

  return `${scored}<p class="muted">Not scored (its answers do not separate outcomes once the other questions are known):</p><ul class="muted">${unscored}</ul>`;
}

const STYLE = `
.viz-root {
  color-scheme: light;
  --page: #f9f9f7; --surface-1: #fcfcfb; --text-primary: #0b0b0b; --text-secondary: #52514e;
  --muted: #898781; --grid: #e1e0d9; --axis: #c3c2b7;
  --tier-1: #104281; --tier-2: #2a78d6; --tier-3: #86b6ef;
  --series-1: #2a78d6; --series-2: #eb6834; --good: #006300; --critical: #d03b3b;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .viz-root {
    color-scheme: dark;
    --page: #0d0d0d; --surface-1: #1a1a19; --text-primary: #f0efec; --text-secondary: #c3c2b7;
    --muted: #898781; --grid: #2c2c2a; --axis: #383835;
    --tier-1: #9ec5f4; --tier-2: #3987e5; --tier-3: #184f95;
    --series-1: #3987e5; --series-2: #d95926; --good: #0ca30c; --critical: #e66767;
  }
}
* { box-sizing: border-box; }
body { margin: 0; }
.viz-root { background: var(--page); color: var(--text-primary); font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; min-height: 100vh; }
main { max-width: 1040px; margin: 0 auto; padding: 32px 24px 64px; }
h1 { font-size: 24px; margin: 0 0 4px; }
h2 { font-size: 18px; margin: 40px 0 8px; }
h3 { font-size: 14px; margin: 16px 0 8px; color: var(--text-secondary); }
p { margin: 8px 0; max-width: 760px; }
.muted { color: var(--muted); }
.card { background: var(--surface-1); border: 1px solid var(--grid); border-radius: 8px; padding: 16px 20px; margin: 12px 0; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; }
.tile .label { color: var(--text-secondary); font-size: 13px; }
.tile .value { font-size: 28px; font-weight: 600; font-variant-numeric: tabular-nums; }
.tile .delta { font-size: 13px; color: var(--text-secondary); }
.hero .value { font-size: 48px; }
.pass { color: var(--good); font-weight: 600; }
.fail { color: var(--critical); font-weight: 600; }
table { border-collapse: collapse; width: 100%; background: var(--surface-1); font-variant-numeric: tabular-nums; }
th, td { padding: 6px 10px; border-bottom: 1px solid var(--grid); text-align: left; vertical-align: top; }
th { color: var(--text-secondary); font-weight: 500; font-size: 13px; }
th.group { text-align: center; border-bottom: 1px solid var(--axis); }
.n { text-align: right; }
.strong { font-weight: 600; }
tr.chosen td { background: color-mix(in srgb, var(--tier-2) 12%, transparent); }
tr.faded td { color: var(--muted); }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 760px) { .pair { grid-template-columns: 1fr; } }
.swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 8px; }
.swatch.tier_1 { background: var(--tier-1); } .swatch.tier_2 { background: var(--tier-2); } .swatch.tier_3 { background: var(--tier-3); }
.legend { display: flex; gap: 16px; color: var(--text-secondary); font-size: 13px; margin: 4px 0 8px; }
.legend .key { display: inline-block; width: 16px; height: 2px; vertical-align: middle; margin-right: 6px; }
svg { width: 100%; height: auto; display: block; background: var(--surface-1); border-radius: 8px; }
svg text { font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; }
.grid { stroke: var(--grid); stroke-width: 1; }
.axis { stroke: var(--axis); stroke-width: 1; }
.tick { fill: var(--muted); }
.value { fill: var(--text-secondary); }
.ref { stroke: var(--text-secondary); stroke-width: 1; opacity: 0.6; }
.cut { stroke: var(--tier-1); stroke-width: 1; }
.ref-label { fill: var(--text-secondary); font-size: 12px; }
.bar.tier_1 { fill: var(--tier-1); } .bar.tier_2 { fill: var(--tier-2); } .bar.tier_3 { fill: var(--tier-3); }
.bar.thin { opacity: 0.35; }
.hit:hover .bar { opacity: 0.85; }
.line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.line.s1 { stroke: var(--series-1); } .line.s2 { stroke: var(--series-2); }
.dot { stroke: var(--surface-1); stroke-width: 2; } .dot.s1 { fill: var(--series-1); } .dot.s2 { fill: var(--series-2); }
.crosshair { stroke: var(--axis); stroke-width: 1; }
#tip { position: fixed; pointer-events: none; background: var(--surface-1); color: var(--text-primary); border: 1px solid var(--axis);
  border-radius: 6px; padding: 6px 10px; font-size: 13px; box-shadow: 0 2px 8px rgb(0 0 0 / 0.12); display: none; max-width: 320px; }
details { background: var(--surface-1); border: 1px solid var(--grid); border-radius: 8px; margin: 6px 0; }
summary { cursor: pointer; padding: 10px 14px; }
summary .muted { margin-left: 8px; font-size: 13px; }
.cap { display: inline-block; min-width: 28px; font-weight: 600; font-variant-numeric: tabular-nums; }
table.options { border-top: 1px solid var(--grid); }
code { font-size: 13px; }
`;

const SCRIPT = `
const tip = document.getElementById("tip");
function show(text, event) {
  tip.textContent = text;
  tip.style.display = "block";
  tip.style.left = Math.min(event.clientX + 14, innerWidth - tip.offsetWidth - 8) + "px";
  tip.style.top = (event.clientY + 14) + "px";
}
function hide() { tip.style.display = "none"; }
document.querySelectorAll("[data-tip]").forEach((el) => {
  el.addEventListener("mousemove", (event) => show(el.dataset.tip, event));
  el.addEventListener("mouseleave", hide);
});
const sweep = document.getElementById("sweep");
if (sweep) {
  const data = JSON.parse(sweep.dataset.sweep);
  const x0 = Number(sweep.dataset.x0), pw = Number(sweep.dataset.pw);
  const cross = document.getElementById("crosshair");
  const hit = document.getElementById("sweep-hit");
  const fmt = (v) => v === null ? "too few leads" : (100 * v).toFixed(1) + "%";
  hit.addEventListener("mousemove", (event) => {
    const point = sweep.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(sweep.getScreenCTM().inverse());
    const cutoff = Math.max(0, Math.min(100, Math.round(((local.x - x0) / pw) * 100)));
    const d = data[cutoff];
    const cx = x0 + (pw * cutoff) / 100;
    cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
    show("Score " + cutoff + " or above: test " + fmt(d.t) + " (" + Math.round(100 * d.ts) + "% of leads), baseline " + fmt(d.b) + " (" + Math.round(100 * d.bs) + "% of leads)", event);
  });
  hit.addEventListener("mouseleave", () => { hide(); cross.setAttribute("visibility", "hidden"); });
}
`;

export function renderReport(evaluation) {
  const { spec, rubric, candidate, current, parity, verdict } = evaluation;
  const tier1 = rubric.tiers.find((tier) => tier.name === "tier_1").minScore;
  const tier2 = rubric.tiers.find((tier) => tier.name === "tier_2").minScore;
  const tier1Test = candidate.test.tiers[0];
  const [testStart, testEnd] = spec.windows.test;
  const [baseStart, baseEnd] = spec.windows.baseline;
  const aucGain = candidate.test.summary.auc - current.test.summary.auc;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lead tier report: ${escapeHtml(rubric.name)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="viz-root">
<main>
  <h1>Lead tier report: ${escapeHtml(rubric.name)}</h1>
  <p class="muted">Form ${escapeHtml(spec.form)}. Data extracted ${escapeHtml(rubric.generatedFrom.extractedOn)}.
    Points derived on leads created ${baseStart} to ${baseEnd}; every result below is on leads created ${testStart} to ${testEnd}, which the rubric never saw, unless marked baseline.</p>

  <div class="tiles">
    <div class="card tile hero">
      <div class="label">Tier 1 completion, test window</div>
      <div class="value">${pct(tier1Test.rate)}</div>
      <div class="delta"><span class="${verdict.meetsTarget ? "pass" : "fail"}">${verdict.meetsTarget ? "Meets" : "Misses"} the ${spec.targets.tier1MinRate * 100}% goal</span>, ${pct(tier1Test.share, 0)} of leads</div>
    </div>
    <div class="card tile">
      <div class="label">Ranking quality (AUC), test window</div>
      <div class="value">${auc(candidate.test.summary.auc)}</div>
      <div class="delta">vs ${auc(current.test.summary.auc)} for the current rubric (+${aucGain.toFixed(3)})</div>
    </div>
    <div class="card tile">
      <div class="label">Top vs bottom 20% of leads</div>
      <div class="value">${pp(candidate.test.summary.spread)}</div>
      <div class="delta">${pct(candidate.test.summary.topQuintile)} vs ${pct(candidate.test.summary.bottomQuintile)} completion</div>
    </div>
  </div>

  <div class="card">
    <strong>Tiers.</strong> Tier 1 is a score of ${tier1} or more, tier 2 is ${tier2} to ${tier1 - 1}, tier 3 is below ${tier2}.
    Leads from the ${spec.forceTierRules[0].domains.length} blocked email domains are always tier 3.
    The score runs 0-100: the share of available points a lead earned on the questions they were asked.
  </div>

  <h2>How the new rubric compares</h2>
  <p>Outcome: ${escapeHtml(spec.outcome.label.toLowerCase())}. Population: ${escapeHtml(spec.outcome.denominator.toLowerCase())}, ${num(candidate.test.summary.n)} leads in the test window at a ${pct(candidate.test.summary.rate)} average.
    AUC is the chance that a lead who completed the call outscores one who did not (0.5 is a coin flip).</p>
  ${headlineTable(evaluation)}

  <h2>Tiers</h2>
  <p>"Completion, all leads" counts every lead whose 30 days are up, including those who never booked, which is what ops experiences.</p>
  ${tierTables(evaluation)}

  <h2>Completion by score</h2>
  <p>Test window, by 10-point band, colored by tier. Bands under 25 leads are faded.</p>
  <div class="legend">
    <span><span class="swatch tier_1"></span>Tier 1</span><span><span class="swatch tier_2"></span>Tier 2</span><span><span class="swatch tier_3"></span>Tier 3</span>
  </div>
  ${bandChart(evaluation)}

  <h2>Choosing the tier 1 cutoff</h2>
  <p>Completion among leads at or above each cutoff. The cutoff was chosen on the baseline as the widest tier 1 that holds ${spec.targets.tier1MinRate * 100}%; the test line confirms it out of sample.
    Lines stop where fewer than ${spec.targets.minTierDeals} leads remain. Hover for exact values.</p>
  <div class="legend">
    <span><span class="key" style="background: var(--series-1)"></span>Test</span>
    <span><span class="key" style="background: var(--series-2)"></span>Baseline</span>
  </div>
  ${sweepChart(evaluation)}
  <h3>Cutoff table</h3>
  ${sweepTable(evaluation)}

  <h2>Points per question</h2>
  <p>Expand a question to see the points per answer. A question's cap is how much it adds to the ranking given all the others.
    Within a question the weakest answer earns 0 and the strongest earns the cap. Multi-select questions earn their best selected answer.
    Completion rates are baseline-window figures.</p>
  ${rubricTables(evaluation)}

  <h2>Checks and caveats</h2>
  <div class="card">
    <p><strong>Engine parity.</strong> The current rubric, run through the new scoring engine on historical answers, reproduces the score stored at submit time on
      <strong>${num(parity.scoreMatches)} of ${num(parity.n)}</strong> leads and the tier on ${num(parity.tierMatches)} of ${num(parity.n)}.
      The engine that produced this report is the one that ships in the form.</p>
    <p><strong>Method.</strong> ${evaluation.rubric.methodSelection
      .map((entry) => `${entry.method} ${auc(entry.validationAuc)}`)
      .join(", ")} on the validation month (${spec.windows.validation.join(" to ")}); "${escapeHtml(rubric.method)}" was chosen there, without looking at the test window.</p>
    <p><strong>Rep behavior.</strong> Tiers were visible to reps and drove calendar routing until ${"2026-10-09"}, so historical rates partly reflect treatment. Leads since then saw no tier; once they are 30 days old they are a cleaner check.</p>
    <p><strong>Thin questions.</strong> Three newer questions were asked of only a few hundred baseline leads, so they carry small caps until more data accumulates.</p>
  </div>
</main>
<div id="tip" role="tooltip"></div>
</div>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
