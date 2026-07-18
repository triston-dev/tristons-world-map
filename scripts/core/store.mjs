// Scene-flag read/write layer for all world-map data. All WRITES must only ever run on a GM
// client (player mutations arrive here via the socket intent queue, Phase 5) — that keeps
// scene.update() single-writer and sidesteps flag write races.
//
// Read functions take a Scene document (or any object with a `flags` property) so they are
// unit-testable against a plain mock per docs/testing-foundry-logic.md; write functions call
// scene.update() with granular dot-paths so sibling pins are never clobbered.

import { MODULE_ID, PIN_DEFAULTS, ROUTE_DEFAULTS, TRAVEL_DEFAULTS, MAP_CONFIG_DEFAULTS } from "../config.mjs";

/** 16-char alphanumeric id (Foundry-style). crypto.randomUUID exists in browser + node. */
export function newId() {
  return globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Reads (pure — take any object with .flags)
// ---------------------------------------------------------------------------

export function getMapFlags(scene) {
  return scene?.flags?.[MODULE_ID] ?? {};
}

export function isWorldMap(scene) {
  return Boolean(getMapFlags(scene).enabled);
}

export function getPins(scene) {
  return getMapFlags(scene).pins ?? {};
}

export function getPin(scene, id) {
  return getPins(scene)[id] ?? null;
}

/**
 * Normalize raw pin input into a complete pin object (pure).
 * Unknown keys are dropped; missing keys get PIN_DEFAULTS.
 */
export function makePin(data = {}) {
  const pin = { ...PIN_DEFAULTS };
  for (const key of Object.keys(PIN_DEFAULTS)) {
    if (data[key] !== undefined) pin[key] = data[key];
  }
  pin.id = data.id ?? newId();
  pin.x = Number(data.x) || 0;
  pin.y = Number(data.y) || 0;
  return pin;
}

// ---------------------------------------------------------------------------
// Writes (GM client only — granular dot-path updates)
// ---------------------------------------------------------------------------

export async function setWorldMapEnabled(scene, enabled) {
  return scene.update({ [`flags.${MODULE_ID}.enabled`]: Boolean(enabled) });
}

export async function createPin(scene, data) {
  const pin = makePin(data);
  await scene.update({ [`flags.${MODULE_ID}.pins.${pin.id}`]: pin });
  return pin;
}

export async function updatePin(scene, id, changes) {
  const updates = {};
  for (const [key, value] of Object.entries(changes)) {
    updates[`flags.${MODULE_ID}.pins.${id}.${key}`] = value;
  }
  return scene.update(updates);
}

export async function deletePin(scene, id) {
  return scene.update({ [`flags.${MODULE_ID}.pins.-=${id}`]: null });
}

// ---------------------------------------------------------------------------
// Map config / routes / travel state / trail
// ---------------------------------------------------------------------------

export function getMapConfig(scene) {
  return { ...MAP_CONFIG_DEFAULTS, ...(getMapFlags(scene).mapConfig ?? {}) };
}

export async function updateMapConfig(scene, changes) {
  const updates = {};
  for (const [key, value] of Object.entries(changes)) {
    updates[`flags.${MODULE_ID}.mapConfig.${key}`] = value;
  }
  return scene.update(updates);
}

export function getRoutes(scene) {
  return getMapFlags(scene).routes ?? {};
}

export function getRoute(scene, id) {
  return getRoutes(scene)[id] ?? null;
}

/** Normalize raw route input into a complete route object (pure). */
export function makeRoute(data = {}) {
  const route = { ...ROUTE_DEFAULTS };
  for (const key of Object.keys(ROUTE_DEFAULTS)) {
    if (data[key] !== undefined) route[key] = data[key];
  }
  route.id = data.id ?? newId();
  route.waypoints = (route.waypoints ?? []).map((w) => ({ x: Math.round(w.x), y: Math.round(w.y) }));
  return route;
}

export async function createRoute(scene, data) {
  const route = makeRoute(data);
  await scene.update({ [`flags.${MODULE_ID}.routes.${route.id}`]: route });
  return route;
}

export async function updateRoute(scene, id, changes) {
  const updates = {};
  for (const [key, value] of Object.entries(changes)) {
    updates[`flags.${MODULE_ID}.routes.${id}.${key}`] = value;
  }
  return scene.update(updates);
}

export async function deleteRoute(scene, id) {
  return scene.update({ [`flags.${MODULE_ID}.routes.-=${id}`]: null });
}

export function getTravelState(scene) {
  return { ...TRAVEL_DEFAULTS, ...(getMapFlags(scene).travelState ?? {}) };
}

export async function updateTravelState(scene, changes) {
  const updates = {};
  for (const [key, value] of Object.entries(changes)) {
    updates[`flags.${MODULE_ID}.travelState.${key}`] = value;
  }
  return scene.update(updates);
}

export function getTrail(scene) {
  return getMapFlags(scene).trail ?? [];
}

export async function appendTrail(scene, entry) {
  const trail = [...getTrail(scene), entry];
  return scene.update({ [`flags.${MODULE_ID}.trail`]: trail });
}

export async function clearTrail(scene) {
  return scene.update({ [`flags.${MODULE_ID}.trail`]: [] });
}
