// Pin visibility state machine + player projection. PURE — no Foundry globals — so the
// "GM pins never leak to players" guarantee gets direct unit coverage
// (tools/tests/discovery.test.mjs), per docs/testing-foundry-logic.md.

import { VISIBILITY } from "../config.mjs";

/** Whether a given pin should render for a user. */
export function isPinVisibleTo(pin, { isGM = false } = {}) {
  if (isGM) return true;
  return pin.visibility === VISIBILITY.VISIBLE || pin.visibility === VISIBILITY.DISCOVERED;
}

/**
 * Reveal a hidden pin (perception success, GM reveal, proximity). Returns the CHANGES object
 * to apply via store.updatePin — not a mutated pin. GM-only pins are never revealed this way.
 */
export function revealChanges(pin, day = null) {
  if (pin.visibility !== VISIBILITY.HIDDEN) return null;
  return { visibility: VISIBILITY.DISCOVERED, discoveredOn: day };
}

/** Re-hide a discovered pin (GM undo). */
export function hideChanges(pin) {
  if (pin.visibility !== VISIBILITY.DISCOVERED && pin.visibility !== VISIBILITY.VISIBLE) return null;
  return { visibility: VISIBILITY.HIDDEN, discoveredOn: null };
}

/** GM-facing fields that must never reach a player client's render context. */
const GM_ONLY_FIELDS = ["gmNotes"];

/**
 * Project a pins map for a player: filters out gm/hidden pins and strips GM-only fields.
 * THE load-bearing privacy guard of the module — every player-facing render path must go
 * through this (or isPinVisibleTo) rather than reading raw flags.
 */
export function projectPinsForPlayer(pins) {
  const out = {};
  for (const [id, pin] of Object.entries(pins ?? {})) {
    if (!isPinVisibleTo(pin, { isGM: false })) continue;
    const copy = { ...pin };
    for (const field of GM_ONLY_FIELDS) delete copy[field];
    out[id] = copy;
  }
  return out;
}
