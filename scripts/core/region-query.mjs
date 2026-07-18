// Region hit-testing for the party marker (a PIXI sprite, not a Token — native region events
// don't fire for it, so the day-tick point-tests instead; plan risk #4). testPoint on the
// Region placeable was live-verified present on 13.351.

import { MODULE_ID } from "../config.mjs";

/** Whether a region contains a point (elevation 0). */
export function regionContains(region, point) {
  // v13 testPoint takes an ElevatedPoint: {x, y, elevation} as ONE object — a second
  // positional elevation arg is ignored and the test silently fails (live-debugged
  // 2026-07-17 on 13.351: {x,y} → false, {x,y,elevation:0} → true).
  try {
    return region.testPoint?.({ x: point.x, y: point.y, elevation: 0 }) ?? false;
  } catch (err) {
    console.warn(`${MODULE_ID} | region testPoint failed for ${region.name}`, err);
    return false;
  }
}

/**
 * All regions whose area is crossed by the from→to segment (sampled every stepPx, endpoints
 * included). Returns RegionDocuments.
 */
export function regionsOnPath(scene, from, to, stepPx = 50) {
  const hits = new Set();
  const total = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(total / stepPx));
  for (const region of scene.regions) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      if (regionContains(region, point)) {
        hits.add(region);
        break;
      }
    }
  }
  return [...hits];
}

/** Enabled behaviors of one of this module's sub-types on a region. */
export function moduleBehaviors(region, subtype) {
  const type = `${MODULE_ID}.${subtype}`;
  return region.behaviors.filter((b) => b.type === type && !b.disabled);
}
