// Foundry-facing travel driver: reads state, runs the pure tickDay reducer, persists, and
// fires the per-day hook pipeline. GM client only (all writes go through store).
//
// Hook contract (the Phase 4/6 extension point):
//   Hooks.callAll("tristons-world-map.travelDay", context)
// where context = { scene, day, from, to, moved, travelState } — encounter rolls, perception
// triggers, weather, and supplies all subscribe to this one hook so the pipeline order is
// simply subscription order within this module.

import { MODULE_ID, ROUTE_STATUS } from "../config.mjs";
import {
  getRoute, getRoutes, updateRoute, getTravelState, updateTravelState,
  getMapConfig, appendTrail
} from "./store.mjs";
import { tickDay, routeReadout } from "./travel-engine.mjs";
import { normalizePaceSets } from "./pace.mjs";
import { runDayPipeline } from "./day-events.mjs";
import { regionsOnPath, moduleBehaviors } from "./region-query.mjs";

/** Combined terrain speed multiplier from encounter zones containing a point. */
function terrainMultAt(scene, point) {
  if (!point) return 1;
  let mult = 1;
  for (const region of regionsOnPath(scene, point, point)) {
    for (const behavior of moduleBehaviors(region, "encounterZone")) {
      mult *= behavior.system.terrainMult ?? 1;
    }
  }
  return mult;
}

export function getPaceSets() {
  return normalizePaceSets(game.settings.get(MODULE_ID, "paceSets"));
}

export async function savePaceSets(sets) {
  return game.settings.set(MODULE_ID, "paceSets", normalizePaceSets(sets));
}

/** Activate a route: snap the party to its start and mark it active. */
export async function startRoute(scene, routeId) {
  const route = getRoute(scene, routeId);
  if (!route || route.waypoints.length < 2) return null;
  const prevActive = getTravelState(scene).activeRouteId;
  if (prevActive && prevActive !== routeId) {
    await updateRoute(scene, prevActive, { status: ROUTE_STATUS.PLANNED });
  }
  await updateRoute(scene, routeId, { status: ROUTE_STATUS.ACTIVE });
  await updateTravelState(scene, {
    activeRouteId: routeId,
    segmentIndex: 0,
    progressPx: 0,
    marker: { ...route.waypoints[0] }
  });
  return route;
}

/** Deactivate travel without finishing the route. */
export async function stopTravel(scene) {
  const state = getTravelState(scene);
  if (state.activeRouteId) {
    await updateRoute(scene, state.activeRouteId, { status: ROUTE_STATUS.PLANNED });
  }
  return updateTravelState(scene, { activeRouteId: null });
}

/** Current readout for UI (remaining distance, ETA) or null when no active route. */
export function activeReadout(scene) {
  const state = getTravelState(scene);
  const route = state.activeRouteId ? getRoute(scene, state.activeRouteId) : null;
  if (!route) return null;
  return routeReadout({
    travelState: state,
    route,
    gridPx: scene.grid.size,
    mapConfig: getMapConfig(scene),
    paceSets: getPaceSets()
  });
}

/**
 * Travel up to n days along the active route. Stops early when the route completes.
 * Returns the day contexts that were executed.
 */
export async function travelDays(scene, n = 1) {
  const results = [];
  for (let i = 0; i < n; i++) {
    const state = getTravelState(scene);
    const route = state.activeRouteId ? getRoute(scene, state.activeRouteId) : null;
    if (!route) break;

    const mapConfig = getMapConfig(scene);
    const result = tickDay({
      travelState: state,
      route,
      gridPx: scene.grid.size,
      mapConfig,
      paceSets: getPaceSets(),
      extraSpeedMult: terrainMultAt(scene, state.marker)
    });

    await updateTravelState(scene, result.travelState);
    await appendTrail(scene, {
      day: result.travelState.day,
      from: { x: Math.round(result.moved.from.x), y: Math.round(result.moved.from.y) },
      to: { x: Math.round(result.moved.to.x), y: Math.round(result.moved.to.y) },
      units: Math.round(result.moved.units * 10) / 10
    });

    const context = {
      scene,
      day: result.travelState.day,
      from: result.moved.from,
      to: result.moved.to,
      moved: result.moved,
      travelState: result.travelState,
      events: []
    };
    Hooks.callAll(`${MODULE_ID}.travelDay`, context); // third-party listeners (sync)
    await runDayPipeline(context); // this module's own awaited pipeline
    results.push(context);

    const paceSets = getPaceSets();
    const unitLabel = mapConfig.unitLabel;
    await ChatMessage.create({
      content: game.i18n.format("TWM.Travel.DayMessage", {
        day: result.travelState.day,
        units: Math.round(result.moved.units * 10) / 10,
        unitLabel
      })
    });

    if (mapConfig.advanceWorldTime) await game.time.advance(86400);

    if (result.finished) {
      await updateRoute(scene, route.id, { status: ROUTE_STATUS.DONE });
      await updateTravelState(scene, { activeRouteId: null });
      await ChatMessage.create({
        content: game.i18n.format("TWM.Travel.ArrivedMessage", { route: route.name })
      });
      break;
    }
  }
  return results;
}
