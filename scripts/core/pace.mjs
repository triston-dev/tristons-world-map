// Pace-set model: fully editable, unit-agnostic (miles/day, parsecs/day, hexes/watch — the
// GM decides). Pure — no Foundry globals. Stored as a world setting (array of sets).

export const DEFAULT_PACE_SETS = [
  {
    id: "dnd5e-overland",
    name: "D&D 5e Overland",
    unitLabel: "miles",
    timeLabel: "day",
    paces: [
      { id: "slow", name: "Slow", perDay: 18, note: "Able to use stealth" },
      { id: "normal", name: "Normal", perDay: 24, note: "" },
      { id: "fast", name: "Fast", perDay: 30, note: "−5 passive Perception" }
    ]
  }
];

/** Deep-clone the defaults (settings storage should never share references). */
export function defaultPaceSets() {
  return structuredClone(DEFAULT_PACE_SETS);
}

/**
 * Validate/repair a raw paceSets value from settings. Anything unusable falls back to the
 * defaults; individual malformed paces are dropped; a set with no valid paces is dropped.
 */
export function normalizePaceSets(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return defaultPaceSets();
  const sets = [];
  for (const set of raw) {
    if (!set || typeof set.id !== "string" || !set.id) continue;
    const paces = (Array.isArray(set.paces) ? set.paces : [])
      .filter((p) => p && typeof p.id === "string" && Number(p.perDay) > 0)
      .map((p) => ({ id: p.id, name: String(p.name ?? p.id), perDay: Number(p.perDay), note: String(p.note ?? "") }));
    if (!paces.length) continue;
    sets.push({
      id: set.id,
      name: String(set.name ?? set.id),
      unitLabel: String(set.unitLabel ?? "miles"),
      timeLabel: String(set.timeLabel ?? "day"),
      paces
    });
  }
  return sets.length ? sets : defaultPaceSets();
}

/** Find a pace set by id, falling back to the first set. */
export function getPaceSet(sets, id) {
  return sets.find((s) => s.id === id) ?? sets[0];
}

/** Find a pace within a set by id, falling back to the middle/first pace. */
export function getPace(set, paceId) {
  return set.paces.find((p) => p.id === paceId)
    ?? set.paces[Math.floor(set.paces.length / 2)]
    ?? set.paces[0];
}

/** A fresh custom pace set (id must be unique among existing). */
export function makeCustomPaceSet(existing, { name = "Custom", unitLabel = "units", timeLabel = "day" } = {}) {
  let n = 1;
  while (existing.some((s) => s.id === `custom-${n}`)) n++;
  return {
    id: `custom-${n}`,
    name,
    unitLabel,
    timeLabel,
    paces: [
      { id: "slow", name: "Slow", perDay: 1, note: "" },
      { id: "normal", name: "Normal", perDay: 2, note: "" },
      { id: "fast", name: "Fast", perDay: 3, note: "" }
    ]
  };
}
