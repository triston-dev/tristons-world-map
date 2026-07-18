// Daily weather: weighted built-in table (pure) or a GM-supplied RollTable (mapConfig.
// climateTableUuid — its result text becomes the weather name, speedMult defaults 1 unless
// the text contains "[xN]" e.g. "Blizzard [x0.5]"). Pure logic here; the Foundry-facing
// caller is scripts/core/day-events.mjs.

export const DEFAULT_WEATHER = [
  { id: "clear", name: "Clear skies", speedMult: 1, weight: 5 },
  { id: "overcast", name: "Overcast", speedMult: 1, weight: 3 },
  { id: "rain", name: "Rain", speedMult: 0.9, weight: 3 },
  { id: "fog", name: "Dense fog", speedMult: 0.75, weight: 2 },
  { id: "storm", name: "Storm", speedMult: 0.6, weight: 1 },
  { id: "snow", name: "Heavy snow", speedMult: 0.5, weight: 1 }
];

/** Weighted pick. rand ∈ [0,1). Pure. */
export function pickWeighted(entries, rand) {
  const total = entries.reduce((s, e) => s + (e.weight ?? 1), 0);
  let cursor = rand * total;
  for (const entry of entries) {
    cursor -= entry.weight ?? 1;
    if (cursor < 0) return entry;
  }
  return entries[entries.length - 1];
}

/** Roll the built-in table. Pure (inject rand). */
export function rollDefaultWeather(rand) {
  const e = pickWeighted(DEFAULT_WEATHER, rand);
  return { current: e.name, speedMult: e.speedMult };
}

/**
 * Parse a speed multiplier out of custom-table result text: "Blizzard [x0.5]" → 0.5.
 * Pure. Returns 1 when no tag present.
 */
export function parseSpeedMult(text) {
  const m = /\[x\s*([0-9]*\.?[0-9]+)\s*\]/i.exec(text ?? "");
  const v = m ? Number(m[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : 1;
}

/** Strip the [xN] tag for display. Pure. */
export function weatherDisplayName(text) {
  return String(text ?? "").replace(/\[x\s*[0-9]*\.?[0-9]+\s*\]/i, "").trim();
}
