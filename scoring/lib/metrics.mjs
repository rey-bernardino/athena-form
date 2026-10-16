// Ranking and tier metrics over scored deals: [{ score, y }] with y in {0, 1}.

export function rate(rows) {
  if (!rows.length) return null;

  return rows.reduce((total, row) => total + row.y, 0) / rows.length;
}

// Probability that a random completer outscores a random non-completer, with
// ties counted as half. Computed from average ranks, so ties are exact.
export function auc(rows) {
  const sorted = [...rows].sort((a, b) => a.score - b.score);
  const positives = sorted.filter((row) => row.y === 1).length;
  const negatives = sorted.length - positives;

  if (!positives || !negatives) return null;

  let rankSum = 0;
  let i = 0;

  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].score === sorted[i].score) j++;

    const averageRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      if (sorted[k].y === 1) rankSum += averageRank;
    }

    i = j;
  }

  return (rankSum - (positives * (positives + 1)) / 2) / (positives * negatives);
}

// Rate in the bottom and top fifth of leads by score, ties broken by input
// order so a lumpy score cannot put more than a fifth in either end.
export function quintileSpread(rows) {
  const sorted = [...rows].sort((a, b) => a.score - b.score);
  const fifth = Math.floor(sorted.length / 5);

  if (!fifth) return null;

  const bottom = rate(sorted.slice(0, fifth));
  const top = rate(sorted.slice(-fifth));

  return { bottom, top, spread: top - bottom };
}

// Share of all completions found in the top `share` of leads by score.
export function topCapture(rows, share = 0.2) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const total = sorted.reduce((sum, row) => sum + row.y, 0);
  const take = Math.round(sorted.length * share);

  if (!total) return null;

  return sorted.slice(0, take).reduce((sum, row) => sum + row.y, 0) / total;
}

export function bands(rows, width = 10, max = 100) {
  const out = [];

  for (let low = 0; low < max; low += width) {
    const high = low + width;
    const inBand = rows.filter((row) => {
      return row.score >= low && (row.score < high || (high >= max && row.score <= max));
    });

    out.push({ label: `${low}-${high >= max ? max : high - 1}`, n: inBand.length, rate: rate(inBand) });
  }

  return out;
}

// For every candidate cutoff: what a tier of "score >= cutoff" would hold.
export function cutoffSweep(rows, max = 100) {
  const out = [];

  for (let cutoff = 0; cutoff <= max; cutoff++) {
    const above = rows.filter((row) => row.score >= cutoff);
    const below = rows.filter((row) => row.score < cutoff);

    out.push({
      cutoff,
      shareAbove: rows.length ? above.length / rows.length : null,
      nAbove: above.length,
      rateAbove: rate(above),
      nBelow: below.length,
      rateBelow: rate(below),
    });
  }

  return out;
}

export function tierTable(rows, tierNames) {
  return tierNames.map((name) => {
    const inTier = rows.filter((row) => row.tier === name);

    return {
      tier: name,
      n: inTier.length,
      share: rows.length ? inTier.length / rows.length : null,
      rate: rate(inTier),
    };
  });
}

export function summarize(rows) {
  const quintiles = quintileSpread(rows);

  return {
    n: rows.length,
    rate: rate(rows),
    auc: auc(rows),
    bottomQuintile: quintiles?.bottom ?? null,
    topQuintile: quintiles?.top ?? null,
    spread: quintiles?.spread ?? null,
    top20Capture: topCapture(rows, 0.2),
  };
}
