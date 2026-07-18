// dnd5e perception adapter with a system-agnostic fallback — the ONLY file that knows dnd5e's
// skill data shape / roll API, so system fragility is contained here (plan risk #5).

import { MODULE_ID } from "../config.mjs";

/** The party: player-owned characters. (Group-actor support can layer on later.) */
export function getPartyActors() {
  return game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner);
}

/** Passive Perception; falls back to 10 outside dnd5e-shaped systems. */
export function passivePerception(actor) {
  return actor?.system?.skills?.prc?.passive ?? 10;
}

/**
 * Active Perception roll total. dnd5e 5.x config-object signature
 * (rollSkill({skill}, dialog, message)); any failure degrades to the passive value.
 */
export async function activePerception(actor) {
  try {
    const rolls = await actor.rollSkill({ skill: "prc" }, { configure: false }, { create: false });
    const roll = Array.isArray(rolls) ? rolls[0] : rolls;
    const total = roll?.total;
    if (typeof total === "number") return total;
  } catch (err) {
    console.warn(`${MODULE_ID} | active Perception roll failed for ${actor?.name}; using passive`, err);
  }
  return passivePerception(actor);
}

/**
 * Check the whole party against a DC.
 * @param {number} dc
 * @param {"passive"|"active"} mode
 * @returns {Promise<{results: Array<{name, value, success}>, anySuccess: boolean}>}
 */
export async function partyPerceptionCheck(dc, mode = "passive") {
  const party = getPartyActors();
  const results = [];
  for (const actor of party) {
    const value = mode === "active" ? await activePerception(actor) : passivePerception(actor);
    results.push({ name: actor.name, value, success: value >= dc });
  }
  return { results, anySuccess: results.some((r) => r.success) };
}
